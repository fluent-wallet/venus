import { ExecutedStatus, type Receipt, TxStatus } from '@core/database/models/Tx/type';
import type { IChainProvider } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { CFX_RPC, EVM_RPC } from './rpc';

export type NonceUsedState = 'not_used' | 'temp_used' | 'finalized_used';
export type TxPresence = 'missing' | 'present' | 'skipped_or_replaced';

export type FinalityWaterline = {
  safe?: bigint; // EVM: safe blockNumber; CFX: latestConfirmed epoch
  finalized?: bigint; // EVM: finalized blockNumber; CFX: latestFinalized epoch
};

export type ExecutedSnapshot = {
  txStatus: TxStatus.EXECUTED | TxStatus.CONFIRMED | TxStatus.FINALIZED;
  executedStatus: ExecutedStatus;
  receipt: Receipt;
  executedAt?: Date;
  err?: string;
};

export interface TxSyncDriver {
  readonly networkType: NetworkType;

  getPendingNonce(addressValue: string): Promise<number>;
  getNonceUsedState(addressValue: string, nonce: number): Promise<NonceUsedState>;

  batchGetPresence(hashes: string[]): Promise<TxPresence[]>;
  batchGetReceipts(hashes: string[]): Promise<(unknown | null)[]>;

  getFinalityWaterline(): Promise<FinalityWaterline>;
  batchGetBlockTimestampsMs(blockHashes: Array<string | null | undefined>): Promise<Array<number | undefined>>;

  sendRawTransaction(raw: string): Promise<string>;

  getReceiptBlockHash(receipt: unknown): string | null;
  getReceiptBlockNumber(receipt: unknown): bigint | null;

  normalizeExecuted(params: { receipt: unknown; executedAtMs?: number; waterline: FinalityWaterline }): ExecutedSnapshot;
}

const toNumFromHex = (raw: string): number => Number(BigInt(raw));

const toBigIntOrUndef = (value?: string | null): bigint | undefined => {
  if (!value) return undefined;
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
};

class EvmTxSyncDriver implements TxSyncDriver {
  readonly networkType: NetworkType;
  private readonly provider: IChainProvider;

  constructor(provider: IChainProvider) {
    this.provider = provider;
    this.networkType = provider.networkType;
  }
  async getPendingNonce(addressValue: string): Promise<number> {
    const raw = await this.provider.rpc.request<string>(EVM_RPC.getTransactionCount, [addressValue, 'pending']);
    return toNumFromHex(raw);
  }

  async getNonceUsedState(addressValue: string, nonce: number): Promise<NonceUsedState> {
    const [latestRaw, finalizedRaw] = await this.provider.rpc.batch<string>([
      { method: EVM_RPC.getTransactionCount, params: [addressValue, 'latest'] },
      { method: EVM_RPC.getTransactionCount, params: [addressValue, 'finalized'] },
    ]);

    const latest = toNumFromHex(latestRaw);
    const finalized = toNumFromHex(finalizedRaw);

    if (finalized > nonce) return 'finalized_used';
    if (latest > nonce) return 'temp_used';
    return 'not_used';
  }

  async batchGetPresence(hashes: string[]): Promise<TxPresence[]> {
    const res = await this.provider.rpc.batch(hashes.map((hash) => ({ method: EVM_RPC.getTransactionByHash, params: [hash] })));
    return res.map((item) => (item ? 'present' : 'missing'));
  }
  async batchGetReceipts(hashes: string[]): Promise<(unknown | null)[]> {
    return await this.provider.rpc.batch(hashes.map((hash) => ({ method: EVM_RPC.getTransactionReceipt, params: [hash] })));
  }

  async getFinalityWaterline(): Promise<FinalityWaterline> {
    const [safeBlock, finalizedBlock] = await this.provider.rpc.batch<any>([
      { method: EVM_RPC.getBlockByNumber, params: ['safe', false] },
      { method: EVM_RPC.getBlockByNumber, params: ['finalized', false] },
    ]);

    return {
      safe: toBigIntOrUndef(safeBlock?.number),
      finalized: toBigIntOrUndef(finalizedBlock?.number),
    };
  }

  async batchGetBlockTimestampsMs(blockHashes: Array<string | null | undefined>): Promise<Array<number | undefined>> {
    const out = new Array<number | undefined>(blockHashes.length).fill(undefined);

    const reqs: Array<{ method: string; params?: any[] }> = [];
    const idxs: number[] = [];

    for (let i = 0; i < blockHashes.length; i += 1) {
      const h = blockHashes[i];
      if (!h) continue;
      idxs.push(i);
      reqs.push({ method: EVM_RPC.getBlockByHash, params: [h, false] });
    }

    if (reqs.length === 0) return out;

    const blocks = await this.provider.rpc.batch<any>(reqs);
    for (let j = 0; j < blocks.length; j += 1) {
      const b = blocks[j];
      const ts = b?.timestamp;
      if (!ts) continue;
      try {
        out[idxs[j]] = Number(BigInt(ts)) * 1000;
      } catch {
        // ignore
      }
    }

    return out;
  }
  sendRawTransaction(raw: string): Promise<string> {
    return this.provider.rpc.request<string>(EVM_RPC.sendRawTransaction, [raw]);
  }
  getReceiptBlockHash(receipt: unknown): string | null {
    return (receipt as any)?.blockHash ?? null;
  }

  getReceiptBlockNumber(receipt: unknown): bigint | null {
    const raw = (receipt as any)?.blockNumber;
    if (!raw) return null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }

  normalizeExecuted(params: { receipt: unknown; executedAtMs?: number; waterline: FinalityWaterline }): ExecutedSnapshot {
    const r = params.receipt as any;

    const receipt: Receipt = {
      cumulativeGasUsed: r.cumulativeGasUsed ?? null,
      effectiveGasPrice: r.effectiveGasPrice ?? null,
      type: r.type ?? '0x0',
      blockHash: r.blockHash ?? null,
      transactionIndex: r.transactionIndex ?? null,
      blockNumber: r.blockNumber ?? null,
      gasUsed: r.gasUsed ?? null,
      contractCreated: r.contractAddress ?? null,
    };

    const txBlock = this.getReceiptBlockNumber(params.receipt) ?? 0n;

    let txStatus: TxStatus.EXECUTED | TxStatus.CONFIRMED | TxStatus.FINALIZED = TxStatus.EXECUTED;
    if (params.waterline.finalized && txBlock <= params.waterline.finalized) txStatus = TxStatus.FINALIZED;
    else if (params.waterline.safe && txBlock <= params.waterline.safe) txStatus = TxStatus.CONFIRMED;

    const executedStatus: ExecutedStatus = r.status === '0x1' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED;

    return {
      txStatus,
      executedStatus,
      receipt,
      executedAt: typeof params.executedAtMs === 'number' ? new Date(params.executedAtMs) : undefined,
      err: executedStatus === '0' ? (r.txExecErrorMsg ?? 'tx failed') : undefined,
    };
  }
}

class CfxTxSyncDriver implements TxSyncDriver {
  readonly networkType: NetworkType;
  private readonly provider: IChainProvider;

  constructor(provider: IChainProvider) {
    this.provider = provider;
    this.networkType = provider.networkType;
  }

  async getPendingNonce(addressValue: string): Promise<number> {
    const raw = await this.provider.rpc.request<string>(CFX_RPC.getNextNonce, [addressValue]);
    return toNumFromHex(raw);
  }

  async getNonceUsedState(addressValue: string, nonce: number): Promise<NonceUsedState> {
    const [latestRaw, finalizedRaw] = await this.provider.rpc.batch<string>([
      { method: CFX_RPC.getNextNonce, params: [addressValue, 'latest_state'] },
      { method: CFX_RPC.getNextNonce, params: [addressValue, 'latest_finalized'] },
    ]);

    const latest = toNumFromHex(latestRaw);
    const finalized = toNumFromHex(finalizedRaw);

    if (finalized > nonce) return 'finalized_used';
    if (latest > nonce) return 'temp_used';
    return 'not_used';
  }

  async batchGetPresence(hashes: string[]): Promise<TxPresence[]> {
    const res = await this.provider.rpc.batch<any>(hashes.map((hash) => ({ method: CFX_RPC.getTransactionByHash, params: [hash] })));

    return res.map((tx) => {
      if (!tx) return 'missing';
      const st = tx.status;
      if (st !== '0x1' && st !== '0x0') return 'skipped_or_replaced';
      return 'present';
    });
  }
  async batchGetReceipts(hashes: string[]): Promise<(unknown | null)[]> {
    return await this.provider.rpc.batch<unknown>(hashes.map((hash) => ({ method: CFX_RPC.getTransactionReceipt, params: [hash] })));
  }
  async getFinalityWaterline(): Promise<FinalityWaterline> {
    const st = await this.provider.rpc.request<any>(CFX_RPC.getStatus, []);
    return {
      safe: toBigIntOrUndef(st?.latestConfirmed),
      finalized: toBigIntOrUndef(st?.latestFinalized),
    };
  }

  async batchGetBlockTimestampsMs(blockHashes: Array<string | null | undefined>): Promise<Array<number | undefined>> {
    const out = new Array<number | undefined>(blockHashes.length).fill(undefined);

    const reqs: Array<{ method: string; params?: any[] }> = [];
    const idxs: number[] = [];

    for (let i = 0; i < blockHashes.length; i += 1) {
      const h = blockHashes[i];
      if (!h) continue;
      idxs.push(i);
      reqs.push({ method: CFX_RPC.getBlockByHash, params: [h, false] });
    }

    if (reqs.length === 0) return out;

    const blocks = await this.provider.rpc.batch<any>(reqs);
    for (let j = 0; j < blocks.length; j += 1) {
      const b = blocks[j];
      const ts = b?.timestamp;
      if (!ts) continue;
      try {
        out[idxs[j]] = Number(BigInt(ts)) * 1000;
      } catch {
        // ignore
      }
    }

    return out;
  }

  sendRawTransaction(raw: string): Promise<string> {
    return this.provider.rpc.request<string>(CFX_RPC.sendRawTransaction, [raw]);
  }

  getReceiptBlockHash(receipt: unknown): string | null {
    return (receipt as any)?.blockHash ?? null;
  }

  getReceiptBlockNumber(receipt: unknown): bigint | null {
    const raw = (receipt as any)?.epochNumber;
    if (!raw) return null;
    try {
      return BigInt(raw);
    } catch {
      return null;
    }
  }

  normalizeExecuted(params: { receipt: unknown; executedAtMs?: number; waterline: FinalityWaterline }): ExecutedSnapshot {
    const r = params.receipt as any;

    const receipt: Receipt = {
      type: r.type ?? '0x0',
      blockHash: r.blockHash ?? null,
      transactionIndex: r.index ?? null,
      blockNumber: r.epochNumber ?? null,
      gasUsed: r.gasUsed ?? null,
      gasFee: r.gasFee ?? null,
      effectiveGasPrice: r.effectiveGasPrice ?? null,
      storageCollateralized: r.storageCollateralized ?? null,
      gasCoveredBySponsor: r.gasCoveredBySponsor ?? null,
      storageCoveredBySponsor: r.storageCoveredBySponsor ?? null,
      storageReleased: Array.isArray(r.storageReleased) && r.storageReleased.length ? r.storageReleased : undefined,
      contractCreated: r.contractCreated ?? null,
    };

    const txBlock = this.getReceiptBlockNumber(params.receipt) ?? 0n;

    let txStatus: TxStatus.EXECUTED | TxStatus.CONFIRMED | TxStatus.FINALIZED = TxStatus.EXECUTED;
    if (params.waterline.finalized && txBlock <= params.waterline.finalized) txStatus = TxStatus.FINALIZED;
    else if (params.waterline.safe && txBlock <= params.waterline.safe) txStatus = TxStatus.CONFIRMED;

    const executedStatus: ExecutedStatus = r.outcomeStatus === '0x0' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED;

    return {
      txStatus,
      executedStatus,
      receipt,
      executedAt: typeof params.executedAtMs === 'number' ? new Date(params.executedAtMs) : undefined,
      err: executedStatus === '0' ? (r.txExecErrorMsg ?? 'tx failed') : undefined,
    };
  }
}

export const createTxSyncDriver = (provider: IChainProvider): TxSyncDriver => {
  if (provider.networkType === NetworkType.Ethereum) return new EvmTxSyncDriver(provider);
  if (provider.networkType === NetworkType.Conflux) return new CfxTxSyncDriver(provider);

  throw new Error(`TxSyncDriver: unsupported networkType: ${String(provider.networkType)}`);
};
