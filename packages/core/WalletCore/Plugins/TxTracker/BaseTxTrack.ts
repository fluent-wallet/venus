import plugins from '@core/WalletCore/Plugins';
import type { Network } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { queryDuplicateTx } from '@core/database/models/Tx/query';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, NOT_FINALIZED_TX_STATUSES, TxStatus, type Receipt } from '@core/database/models/Tx/type';
import { TX_RESEND_LIMIT } from '@core/utils/consts';
import { ProcessErrorType } from '@core/utils/eth';
import Transaction from '../Transaction';
import { NonceUsedState, ReplacedResponse } from './types';

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

  async _handleDuplicateTx(tx: Tx, isReplaced = true, finalized = true) {
    try {
      const nonce = (await tx.txPayload).nonce!;
      const txs = await queryDuplicateTx(tx, nonce, NOT_FINALIZED_TX_STATUSES);
      for (const _tx of txs) {
        this._setReplaced(_tx, isReplaced, finalized);
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

  async _handleUnsent(tx: Tx, network: Network) {
    let resend = false;
    let epochHeightOutOfBound = false;
    let replaceReponse = ReplacedResponse.NotReplaced;
    try {
      const nonce = (await tx.txPayload).nonce!;
      replaceReponse = await this._handleCheckReplaced(tx, network.endpoint);
      if (replaceReponse !== ReplacedResponse.NotReplaced) return;
      if (tx.resendCount && tx.resendCount >= TX_RESEND_LIMIT) {
        console.log(`${this._logPrefix}: tx resend limit reached:`, tx.hash);
        return;
      }
      const duplicateTxs = await queryDuplicateTx(tx, nonce, [TxStatus.WAITTING, TxStatus.PENDING, TxStatus.EXECUTED, TxStatus.CONFIRMED, TxStatus.FINALIZED]);
      const latestDuplicateTx = duplicateTxs?.[0];
      if (latestDuplicateTx && latestDuplicateTx.createdAt > tx.createdAt) {
        console.log(`${this._logPrefix}: tx has speedup or canceled:`, tx.hash);
        return;
      }
      epochHeightOutOfBound = await this._checkEpochHeightOutOfBound(tx);
      if (epochHeightOutOfBound) {
        console.log(`${this._logPrefix}: epoch height out of bound:`, tx.hash);
        return;
      }
      resend = true;
      await Transaction.sendRawTransaction({
        network,
        txRaw: tx.raw!,
      });
    } catch (error) {
      console.log(`${this._logPrefix}:`, error);
    } finally {
      tx.updateSelf((tx) => {
        const replaced = replaceReponse === ReplacedResponse.FinalizedReplaced;
        const tempReplaced = replaceReponse === ReplacedResponse.TempReplaced;
        tx.status = replaced ? TxStatus.REPLACED : tempReplaced ? TxStatus.TEMP_REPLACED : epochHeightOutOfBound ? TxStatus.FAILED : TxStatus.PENDING;
        if (resend) {
          tx.resendCount = (tx.resendCount ?? 0) + 1;
          tx.resendAt = new Date();
        }
        if (replaced || epochHeightOutOfBound) {
          tx.raw = null;
          tx.err = null;
          tx.errorType = replaced ? ProcessErrorType.replacedByAnotherTx : ProcessErrorType.epochHeightOutOfBound;
        }
        tx.executedStatus = null;
        tx.receipt = null;
      });
      if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
        this._handleDuplicateTx(tx, false, false);
      }
    }
  }

  async _handleCheckReplaced(tx: Tx, endpoint: string): Promise<ReplacedResponse> {
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
  async _handleCheckNonceUsed(tx: Tx, endpoint: string): Promise<NonceUsedState> {
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
  ) {
    const { txStatus, executedStatus, receipt, txExecErrorMsg, executedAt } = params;
    const prevStatus = tx.status;
    await tx.updateSelf((_tx) => {
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
      }
    });
    if (prevStatus !== txStatus) {
      this._handleDuplicateTx(tx, true, txStatus === TxStatus.FINALIZED);
      if (txStatus === TxStatus.EXECUTED) {
        this._updateTokenBalance(tx);
      }
    }
  }
  async _setReplaced(tx: Tx, isReplaced = true, finalized = true) {
    await tx.updateSelf((_tx) => {
      if (finalized) {
        _tx.status = TxStatus.REPLACED;
        _tx.raw = null;
        _tx.err = null;
        _tx.errorType = ProcessErrorType.replacedByAnotherTx;
      }
      _tx.isReplacedByInner = isReplaced;
      if (isReplaced) {
        _tx.executedStatus = null;
        _tx.receipt = null;
        _tx.executedAt = null;
      }
    });
  }
  async _setTempReplaced(tx: Tx) {
    const prevStatus = tx.status;
    await tx.updateSelf((_tx) => {
      _tx.status = TxStatus.TEMP_REPLACED;
      _tx.executedStatus = null;
      _tx.receipt = null;
      _tx.executedAt = null;
    });
    if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(prevStatus)) {
      this._handleDuplicateTx(tx, false, false);
    }
  }
  async _setPending(tx: Tx) {
    const prevStatus = tx.status;
    await tx.updateSelf((_tx) => {
      _tx.status = TxStatus.PENDING;
      _tx.executedStatus = null;
      _tx.receipt = null;
      _tx.executedAt = null;
    });
    if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(prevStatus)) {
      this._handleDuplicateTx(tx, false, false);
    }
  }

  abstract _checkStatus(txs: Tx[], network: Network, returnStatus?: boolean): Promise<TxStatus | undefined>;
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
