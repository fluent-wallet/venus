import { ExecutedStatus, TxStatus, type Receipt } from '@core/database/models/Tx/type';
import { ProcessErrorType } from '@core/utils/eth';

import { createTxSyncDriver, type TxPresence, type TxSyncDriver } from './TxSyncDriver';
import type { IChainProvider } from '@core/types';

export type TxSyncTxSnapshot = {
  txId: string;
  status: TxStatus;
  nonce: number;
  hash: string | null;
  raw: string | null;
  resendCount: number;
  createdAtMs: number;
};

export type TxSyncTxPatch = {
  txId: string;
  set: Partial<{
    status: TxStatus;
    raw: string | null;
    executedStatus: ExecutedStatus | null;
    receipt: Receipt | null;
    executedAt: Date | null;
    errorType: ProcessErrorType | null;
    err: string | null;
    resendAt: Date | null;
    resendCount: number | null;
    isTempReplacedByInner: boolean | null;
  }>;
};

export type TxSyncEngineInput = {
  txs: TxSyncTxSnapshot[]; // min nonce group (incl duplicate nonce)
  provider: IChainProvider;
  addressValue: string;
  now: () => number;
  maxResendCount: number; // default Infinity
};

export type TxSyncEngineResult = {
  status?: TxStatus;
  patches: TxSyncTxPatch[];
};

export class TxSyncEngine {
  async run(input: TxSyncEngineInput): Promise<TxSyncEngineResult> {
    const driver: TxSyncDriver = createTxSyncDriver(input.provider);

    const patchById = new Map<string, TxSyncTxPatch['set']>();
    let status: TxStatus | undefined;

    const push = (txId: string, set: TxSyncTxPatch['set']) => {
      const prev = patchById.get(txId) ?? {};
      patchById.set(txId, { ...prev, ...set });
    };

    // 0) WAITTING -> PENDING if nonce is reachable
    const pendingNonce = await driver.getPendingNonce(input.addressValue);

    for (const tx of input.txs) {
      if (tx.status === TxStatus.WAITTING && tx.nonce <= pendingNonce) {
        push(tx.txId, { status: TxStatus.PENDING });
      }
    }

    const candidates = input.txs.filter((tx) => !(tx.status === TxStatus.WAITTING && tx.nonce > pendingNonce));

    const hashes = candidates.map((tx) => tx.hash).filter((h): h is string => !!h);
    const presenceByHash = new Map<string, TxPresence>();

    if (hashes.length > 0) {
      const presences = await driver.batchGetPresence(hashes);
      for (let i = 0; i < hashes.length; i += 1) presenceByHash.set(hashes[i], presences[i]);
    }

    // All input.txs belong to the same (min) nonce group.
    const groupNonce = candidates[0]?.nonce;

    let cachedNonceUsedState: Awaited<ReturnType<TxSyncDriver['getNonceUsedState']>> | null = null;
    const getNonceUsedState = async () => {
      if (cachedNonceUsedState) return cachedNonceUsedState;
      if (typeof groupNonce !== 'number') return 'not_used' as const;
      cachedNonceUsedState = await driver.getNonceUsedState(input.addressValue, groupNonce);
      return cachedNonceUsedState;
    };

    // If we need to resend for this nonce group, only resend one tx (pick latest createdAt).
    const resendCandidateId =
      candidates
        .filter((tx) => {
          const h = tx.hash;
          const presence = h ? presenceByHash.get(h) : 'missing';
          return presence !== 'present' && !!tx.raw && tx.resendCount < input.maxResendCount;
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs)[0]?.txId ?? null;

    const presentTxs: TxSyncTxSnapshot[] = [];

    for (const tx of candidates) {
      const h = tx.hash;
      const presence = h ? presenceByHash.get(h) : 'missing';

      if (presence === 'present') {
        presentTxs.push(tx);
        continue;
      }

      // missing or skipped_or_replaced => treat like "unsent" / "receipt-missing" path
      const replaced = await getNonceUsedState();

      if (replaced === 'finalized_used') {
        status = TxStatus.REPLACED;
        push(tx.txId, { status: TxStatus.REPLACED, raw: null, errorType: ProcessErrorType.replacedByAnotherTx, err: null });
        continue;
      }

      if (replaced === 'temp_used') {
        status = TxStatus.TEMP_REPLACED;
        push(tx.txId, { status: TxStatus.TEMP_REPLACED, executedStatus: null, receipt: null });
        continue;
      }

      // not used => DISCARDED + optional resend
      status = TxStatus.DISCARDED;

      if (tx.txId === resendCandidateId && tx.raw && tx.resendCount < input.maxResendCount) {
        await driver.sendRawTransaction(tx.raw);

        push(tx.txId, {
          resendCount: tx.resendCount + 1,
          resendAt: new Date(input.now()),
          status: TxStatus.PENDING,
          err: null,
          errorType: null,
          executedStatus: null,
          receipt: null,
        });

        status = TxStatus.PENDING;
        continue;
      }

      push(tx.txId, { status: TxStatus.DISCARDED, executedStatus: null, receipt: null, err: null, errorType: null });
    }
    if (presentTxs.length > 0) {
      const receiptHashes = presentTxs.map((t) => t.hash!).filter((h): h is string => !!h);
      const receipts = await driver.batchGetReceipts(receiptHashes);

      const withReceipt: Array<{ tx: TxSyncTxSnapshot; receipt: unknown }> = [];

      for (let i = 0; i < presentTxs.length; i += 1) {
        const tx = presentTxs[i];
        const receipt = receipts[i];

        if (!receipt) {
          const used = await getNonceUsedState();

          if (used === 'finalized_used') {
            status = TxStatus.REPLACED;
            push(tx.txId, { status: TxStatus.REPLACED, raw: null, errorType: ProcessErrorType.replacedByAnotherTx, err: null });
          } else if (used === 'temp_used') {
            status = TxStatus.TEMP_REPLACED;
            push(tx.txId, { status: TxStatus.TEMP_REPLACED, executedStatus: null, receipt: null });
          } else {
            status = TxStatus.PENDING;
            push(tx.txId, { status: TxStatus.PENDING, executedStatus: null, receipt: null, err: null, errorType: null });
          }
          continue;
        }

        withReceipt.push({ tx, receipt });
      }

      if (withReceipt.length > 0) {
        const waterline = await driver.getFinalityWaterline();
        const blockHashes = withReceipt.map((it) => driver.getReceiptBlockHash(it.receipt));
        const timestamps = await driver.batchGetBlockTimestampsMs(blockHashes);

        for (let i = 0; i < withReceipt.length; i += 1) {
          const { tx, receipt } = withReceipt[i];

          const executed = driver.normalizeExecuted({ receipt, executedAtMs: timestamps[i], waterline });

          status = executed.txStatus;

          push(tx.txId, {
            status: executed.txStatus,
            executedStatus: executed.executedStatus,
            receipt: executed.receipt,
            executedAt: executed.executedAt ?? null,
            err: executed.executedStatus === '0' ? (executed.err ?? 'tx failed') : null,
            errorType: executed.executedStatus === '0' ? ProcessErrorType.executeFailed : null,
            raw: executed.txStatus === TxStatus.FINALIZED ? null : undefined,
          });

          // duplicate nonce handling is done locally by patches in this nonce group.
        }
      }
    }

    const patches: TxSyncTxPatch[] = [];
    for (const [txId, set] of patchById.entries()) {
      patches.push({ txId, set });
    }

    // If any tx in this nonce group reaches FINALIZED, mark other same-nonce txs as REPLACED.
    const winner = candidates.find((tx) => patchById.get(tx.txId)?.status === TxStatus.FINALIZED);
    if (winner) {
      for (const tx of input.txs) {
        if (tx.nonce !== winner.nonce) continue;
        if (tx.txId === winner.txId) continue;

        push(tx.txId, {
          status: TxStatus.REPLACED,
          raw: null,
          errorType: ProcessErrorType.replacedByAnotherTx,
          err: null,
          isTempReplacedByInner: true,
        });
      }
    }

    const finalPatches: TxSyncTxPatch[] = [];
    for (const [txId, set] of patchById.entries()) finalPatches.push({ txId, set });

    return { status, patches: finalPatches };
  }
}
