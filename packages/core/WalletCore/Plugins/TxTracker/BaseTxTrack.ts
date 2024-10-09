import plugins from '@core/WalletCore/Plugins';
import type { Network } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { queryDuplicateTx } from '@core/database/models/Tx/query';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, NOT_FINALIZED_TX_STATUSES, TxStatus, type Receipt } from '@core/database/models/Tx/type';
import { TX_RESEND_LIMIT } from '@core/utils/consts';
import { ProcessErrorType } from '@core/utils/eth';
import Transaction from '../Transaction';
import { NonceUsedState, ReplacedResponse } from './types';

export type UpdaterMap = Map<Tx, () => Tx>;

export interface RPCErrorResponse {
  message: string;
  code: number;
  data?: unknown;
}

export const isRPCError = (response: unknown): response is RPCErrorResponse => {
  return typeof response === 'object' && !!response && 'code' in (response as RPCErrorResponse) && 'message' in (response as RPCErrorResponse);
};

export abstract class BaseTxTrack {
  _logPrefix: string;

  constructor({ logPrefix }: { logPrefix: string }) {
    this._logPrefix = logPrefix;
  }

  async _handleDuplicateTx(tx: Tx, isReplaced: boolean, finalized: boolean, updaterMap: UpdaterMap) {
    try {
      const nonce = (await tx.txPayload).nonce!;
      const txs = await queryDuplicateTx(tx, nonce, NOT_FINALIZED_TX_STATUSES);
      for (const _tx of txs) {
        this._setReplaced(_tx, isReplaced, finalized, updaterMap);
      }
    } catch (error) {
      console.log(`${this._logPrefix}: `, error);
    }
  }

  async _updateTokenBalance(tx: Tx) {
    try {
      const [txExtra, txPayload] = await Promise.all([tx.txExtra, tx.txPayload]);
      if (txExtra.tokenNft) {
        plugins.NFTDetailTracker.updateCurrentOpenNFT(txPayload.to);
      }
      if (txExtra.simple || txExtra.token20) {
        plugins.AssetsTracker.updateCurrentTracker().catch((err) => console.log(`${this._logPrefix}: `, err));
      }
    } catch (error) {
      console.log(`${this._logPrefix}: `, error);
    }
  }

  async _handleUnsent(tx: Tx, network: Network, updaterMap: UpdaterMap) {
    let resend = false;
    let txStatus = TxStatus.PENDING;
    try {
      const nonce = (await tx.txPayload).nonce!;
      const replaceReponse = await this._handleCheckReplaced(tx, network.endpoint);
      txStatus =
        replaceReponse === ReplacedResponse.FinalizedReplaced
          ? TxStatus.REPLACED
          : replaceReponse === ReplacedResponse.TempReplaced
            ? TxStatus.TEMP_REPLACED
            : TxStatus.PENDING;
      if (
        EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status) &&
        replaceReponse !== ReplacedResponse.FinalizedExecuted &&
        replaceReponse !== ReplacedResponse.TempExecuted
      ) {
        await this._handleDuplicateTx(tx, false, false, updaterMap);
      }
      if (replaceReponse !== ReplacedResponse.NotReplaced) return txStatus;
      if (tx.resendCount && tx.resendCount >= TX_RESEND_LIMIT) {
        txStatus = TxStatus.DISCARDED;
        console.log(`${this._logPrefix}: tx resend limit reached:`, tx.hash);
        return txStatus;
      }
      const duplicateTxs = await queryDuplicateTx(tx, nonce, [
        TxStatus.WAITTING,
        TxStatus.DISCARDED,
        TxStatus.PENDING,
        TxStatus.EXECUTED,
        TxStatus.CONFIRMED,
        TxStatus.FINALIZED,
      ]);
      const latestDuplicateTx = duplicateTxs?.[0];
      if (latestDuplicateTx && latestDuplicateTx.createdAt > tx.createdAt) {
        txStatus = TxStatus.DISCARDED;
        console.log(`${this._logPrefix}: tx has speedup or canceled:`, tx.hash);
        return txStatus;
      }
      resend = true;
      await Transaction.sendRawTransaction({
        network,
        txRaw: tx.raw!,
      });
    } catch (error) {
      console.log(`${this._logPrefix}:`, error);
      // TODO: handle error
    } finally {
      updaterMap.set(tx, () =>
        tx.prepareUpdate((_tx) => {
          _tx.status = txStatus;
          _tx.executedStatus = null;
          _tx.receipt = null;
          _tx.err = null;
          _tx.errorType = null;
          if (resend) {
            _tx.resendCount = (_tx.resendCount ?? 0) + 1;
            _tx.resendAt = new Date();
          }
          if (txStatus === TxStatus.REPLACED) {
            _tx.raw = null;
            _tx.errorType = ProcessErrorType.replacedByAnotherTx;
          }
        }),
      );
    }
  }

  async _handleCheckReplaced(tx: Tx, endpoint: string) {
    try {
      const nonceUsed = await this._handleCheckNonceUsed(tx, endpoint);
      if (nonceUsed === NonceUsedState.NotUsed) {
        return ReplacedResponse.NotReplaced;
      }
      const receipt = await this._getTransactionReceipt(tx.hash!, endpoint);
      if (!receipt) {
        return nonceUsed === NonceUsedState.FinalizedUsed ? ReplacedResponse.FinalizedReplaced : ReplacedResponse.TempReplaced;
      }
      return nonceUsed === NonceUsedState.FinalizedUsed ? ReplacedResponse.FinalizedExecuted : ReplacedResponse.TempExecuted;
    } catch (error) {
      console.log(`${this._logPrefix} checkReplaced error:`, error);
      return ReplacedResponse.NotReplaced;
    }
  }
  async _handleCheckNonceUsed(tx: Tx, endpoint: string) {
    try {
      const nonce = (await tx.txPayload).nonce!;
      const address = await (await tx.address).getValue();
      const { latestNonce, finalizedNonce } = await this._getNonce(address, endpoint);
      if (finalizedNonce && Number(finalizedNonce) > Number(nonce)) {
        return NonceUsedState.FinalizedUsed;
      }
      if (latestNonce && Number(latestNonce) > Number(nonce)) {
        return NonceUsedState.TempUsed;
      }
      return NonceUsedState.NotUsed;
    } catch (error) {
      console.log(`${this._logPrefix} checkNonceUsed error:`, error);
      return NonceUsedState.NotUsed;
    }
  }

  async _setExecuted(
    tx: Tx,
    params: {
      txStatus: TxStatus.EXECUTED | TxStatus.CONFIRMED | TxStatus.FINALIZED;
      executedStatus: ExecutedStatus;
      receipt: Receipt;
      txExecErrorMsg?: string;
      executedAt?: Date;
    },
    updaterMap: UpdaterMap,
  ) {
    const { txStatus, executedStatus, receipt, txExecErrorMsg, executedAt } = params;
    updaterMap.set(tx, () =>
      tx.prepareUpdate((_tx) => {
        if (txStatus === TxStatus.FINALIZED) {
          _tx.raw = null;
        }
        _tx.status = txStatus;
        _tx.executedStatus = executedStatus;
        _tx.receipt = receipt;
        if (executedAt) {
          _tx.executedAt = executedAt;
        }
        if (executedStatus === ExecutedStatus.FAILED) {
          _tx.err = txExecErrorMsg ?? 'tx failed';
          _tx.errorType = ProcessErrorType.executeFailed;
        } else {
          _tx.err = null;
          _tx.errorType = null;
        }
      }),
    );
    if (tx.status !== txStatus) {
      await this._handleDuplicateTx(tx, true, txStatus === TxStatus.FINALIZED, updaterMap);
      if (!EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
        this._updateTokenBalance(tx);
      }
    }
  }
  _setReplaced(tx: Tx, isReplaced: boolean, finalized: boolean, updaterMap: UpdaterMap) {
    updaterMap.set(tx, () =>
      tx.prepareUpdate((_tx) => {
        if (finalized) {
          _tx.status = TxStatus.REPLACED;
          _tx.raw = null;
          _tx.err = null;
          _tx.errorType = ProcessErrorType.replacedByAnotherTx;
        }
        _tx.isTempReplacedByInner = isReplaced;
        if (isReplaced) {
          _tx.executedStatus = null;
          _tx.receipt = null;
          _tx.executedAt = null;
        } else {
          _tx.err = null;
          _tx.errorType = null;
        }
      }),
    );
  }
  async _setTempReplaced(tx: Tx, updaterMap: UpdaterMap) {
    const prevStatus = tx.status;
    updaterMap.set(tx, () =>
      tx.prepareUpdate((_tx) => {
        _tx.status = TxStatus.TEMP_REPLACED;
        _tx.executedStatus = null;
        _tx.receipt = null;
        _tx.executedAt = null;
      }),
    );
    if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(prevStatus)) {
      await this._handleDuplicateTx(tx, false, false, updaterMap);
    }
  }
  async _setPending(tx: Tx, updaterMap: UpdaterMap) {
    updaterMap.set(tx, () =>
      tx.prepareUpdate((_tx) => {
        _tx.status = TxStatus.PENDING;
        _tx.executedStatus = null;
        _tx.receipt = null;
        _tx.executedAt = null;
        _tx.err = null;
        _tx.errorType = null;
      }),
    );
    if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
      await this._handleDuplicateTx(tx, false, false, updaterMap);
    }
  }

  abstract _checkStatus(txs: Tx[], network: Network, updaterMap: UpdaterMap): Promise<TxStatus | undefined>;
  abstract _checkEpochHeightOutOfBound(tx: Tx): Promise<boolean>;
  abstract _getTransactionReceipt(hash: string, endpoint: string): Promise<ETH.eth_getTransactionReceiptResponse | CFX.cfx_getTransactionReceiptResponse>;
  abstract _getNonce(
    address: string,
    endpoint: string,
  ): Promise<{
    latestNonce: string;
    finalizedNonce: string;
  }>;
}
