import { queryDuplicateTx } from '@core/database/models/Tx/query';
import type { Tx } from '@core/database/models/Tx';
import { NOT_FINALIZED_TX_STATUSES, TxStatus } from '@core/database/models/Tx/type';
import plugins from '@core/WalletCore/Plugins';
import { CHECK_REPLACED_BEFORE_RESEND_COUNT, TX_RESEND_LIMIT } from '@core/utils/consts';
import { ReplacedResponse } from './types';
import { ProcessErrorType } from '@core/utils/eth';
import Transaction from '../Transaction';
import { Network } from '@core/database/models/Network';

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
  _latestNonceMap = new Map<string, string>();

  constructor({ logPrefix }: { logPrefix: string }) {
    this._logPrefix = logPrefix;
  }

  async _handleDuplicateTx(tx: Tx, isReplaced = true, finalized = true) {
    try {
      const nonce = (await tx.txPayload).nonce!;
      const txs = await queryDuplicateTx(tx, nonce, NOT_FINALIZED_TX_STATUSES);
      txs.forEach((_tx) => {
        _tx.updateSelf((t) => {
          if (finalized) {
            t.status = TxStatus.REPLACED;
            t.raw = null;
            t.err = null;
            tx.errorType = ProcessErrorType.replacedByAnotherTx;
          }
          t.isTempReplaced = isReplaced;
          if (isReplaced) {
            t.executedStatus = null;
            t.receipt = null;
            t.executedAt = null;
            t.confirmedNumber = null;
          }
        });
      });
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
    let replaced = false;
    let epochHeightOutOfBound = false;
    try {
      await tx.updateSelf((tx) => {
        tx.status = TxStatus.UNSENT;
      });
      const nonce = (await tx.txPayload).nonce!;
      if (tx.resendCount && tx.resendCount >= CHECK_REPLACED_BEFORE_RESEND_COUNT) {
        const replaceReponse = await this._handleCheckReplaced(tx, nonce, network.endpoint);
        replaced = replaceReponse === ReplacedResponse.Replaced;
        if (replaceReponse !== ReplacedResponse.NotReplaced) return;
      }
      if (tx.resendCount && tx.resendCount >= TX_RESEND_LIMIT) {
        console.log(`${this._logPrefix}: tx resend limit reached:`, tx.hash);
        return;
      }
      const duplicateTxs = await queryDuplicateTx(tx, nonce);
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
        tx.status = replaced ? TxStatus.REPLACED : epochHeightOutOfBound ? TxStatus.FAILED : TxStatus.PENDING;
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
        tx.pollingCount = (tx.pollingCount ?? 0) + 1;
      });
    }
  }

  async _handleCheckReplaced(tx: Tx, nonce: number, endpoint: string): Promise<ReplacedResponse> {
    try {
      const nonceUsed = await this._handleCheckNonceUsed(tx, nonce, endpoint);
      if (!nonceUsed) {
        return ReplacedResponse.NotReplaced;
      } else {
        const transaction = await this._getTransactionByHash(tx.hash!, endpoint);
        if (!transaction) {
          return ReplacedResponse.Replaced;
        } else {
          return ReplacedResponse.TxInPool;
        }
      }
    } catch (error) {
      console.log('EthTxTrack error:', error);
      return ReplacedResponse.NotReplaced;
    }
  }
  async _handleCheckNonceUsed(tx: Tx, nonce: number, endpoint: string) {
    try {
      const prevLatestNonce = this._latestNonceMap.get(tx.address.id);
      if (prevLatestNonce && Number(prevLatestNonce) > Number(nonce)) {
        return true;
      }
      const address = await (await tx.address).getValue();
      const latestNonce = await this._getNonce(address, endpoint);
      latestNonce && this._latestNonceMap.set(tx.address.id, latestNonce);
      if (Number(latestNonce) > Number(nonce)) {
        return true;
      }
      return false;
    } catch (error) {
      console.log(`${this._logPrefix} error:`, error);
      return false;
    }
  }

  abstract _checkStatus(txs: Tx[], network: Network, returnStatus?: boolean): Promise<TxStatus | undefined>;
  abstract _checkEpochHeightOutOfBound(tx: Tx): Promise<boolean>;
  abstract _getTransactionByHash(hash: string, endpoint: string): Promise<ETH.eth_getTransactionByHashResponse | CFX.cfx_getTransactionByHashResponse>;
  abstract _getNonce(address: string, endpoint: string): Promise<string>;
}