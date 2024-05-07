import { queryDuplicateTx, queryTxsWithAddress } from '@core/database/models/Tx/query';
import type { Tx } from '@core/database/models/Tx';
import type { Address } from '@core/database/models/Address';
import { NetworkType } from '@core/database/models/Network';
import { NOT_FINALIZED_TX_STATUSES, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse } from '@core/utils/send';
import { debounceTime, Subscription } from 'rxjs';
import plugins from '@core/WalletCore/Plugins';
import events from '@core/WalletCore/Events';
import {
  CHECK_REPLACED_BEFORE_RESEND_COUNT,
  DETAULT_CONFIRMED_INTERVAL,
  DETAULT_EXECUTED_INTERVAL,
  DETAULT_FINALIZED_INTERVAL,
  TX_RESEND_LIMIT,
} from '@core/consts/transaction';
import { ReplacedResponse } from './types';

const getMinNonceTx = async (txs: Tx[]) => {
  if (!txs.length) {
    return;
  }
  const payloads = await Promise.all(txs.map((tx) => tx.txPayload));
  let minNonce = payloads[0].nonce!;
  let minNonceTx = txs[0];
  for (let i = 1; i < txs.length; i++) {
    const payload = payloads[i];
    if (payload.nonce! < minNonce) {
      minNonceTx = txs[i];
      minNonce = payload.nonce!;
    }
  }
  return minNonceTx;
};

export abstract class BaseTxTrack {
  _logPrefix: string;
  _networkType: NetworkType;
  _latestNonceMap = new Map<string, string>();
  _currentAddress: Address | null = null;
  _checkExecutedTimer: NodeJS.Timeout | false | null = null;
  _unexecutedSubscription: Subscription | null = null;
  _checkConfirmedTimer: NodeJS.Timeout | false | null = null;
  _unconfirmedSubscription: Subscription | null = null;
  _checkFinalizedTimer: NodeJS.Timeout | false | null = null;
  _unfinalizedSubscription: Subscription | null = null;

  constructor({ logPrefix, networkType }: { logPrefix: string; networkType: NetworkType }) {
    this._logPrefix = logPrefix;
    this._networkType = networkType;
    this._setup();
  }

  _setup() {
    events.currentAddressObservable.pipe(debounceTime(40)).subscribe((selectedAddress) => {
      this._currentAddress = selectedAddress;
      if (!selectedAddress) {
        this._cleanup();
        console.log(`${this._logPrefix}: no selected address`);
        return;
      }
      this._startup(selectedAddress);
    });
  }

  /**
   * start track && subscribe count change
   */
  async _startup(address: Address) {
    if ((await address.network).networkType === this._networkType) {
      this._checkExecuted();
      this._subscribeUnexecutedTxCount(address);
      this._checkConfirmed();
      this._subscribeUnconfirmedTxCount(address);
      this._checkFinalized();
      this._subscribeUnfinalizedTxCount(address);
    }
  }
  /**
   * stop track && unsubscribe count change
   */
  _cleanup() {
    this._cleanupExecutedTimer();
    this._unexecutedSubscription?.unsubscribe();
    this._unexecutedSubscription = null;
    this._cleanupConfirmedTimer();
    this._unconfirmedSubscription?.unsubscribe();
    this._unconfirmedSubscription = null;
    this._cleanupFinalizedTimer();
    this._unfinalizedSubscription?.unsubscribe();
    this._unfinalizedSubscription = null;
  }

  /**
   * subscribe unexecuted txs count change
   */
  _subscribeUnexecutedTxCount(address: Address) {
    this._unexecutedSubscription?.unsubscribe();
    this._unexecutedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.PENDING],
    })
      .observeCount()
      .subscribe((count) => {
        console.log(`${this._logPrefix}: unexecuted-count`, count);
        if (count > 0 && this._checkExecutedTimer === false) {
          this._resetExecutedTimer();
        }
      });
  }
  /**
   * subscribe unconfirmed txs count change
   */
  _subscribeUnconfirmedTxCount(address: Address) {
    this._unconfirmedSubscription?.unsubscribe();
    this._unconfirmedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.EXECUTED],
    })
      .observeCount()
      .subscribe((count) => {
        console.log(`${this._logPrefix}: unconfirmed-count`, count);
        if (count > 0 && this._checkConfirmedTimer === false) {
          this._resetConfirmedTimer();
        }
      });
  }
  /**
   * subscribe unfinalized txs count change
   */
  _subscribeUnfinalizedTxCount(address: Address) {
    this._unfinalizedSubscription?.unsubscribe();
    this._unfinalizedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.CONFIRMED],
    })
      .observeCount()
      .subscribe((count) => {
        console.log(`${this._logPrefix}: unfinalized-count`, count);
        if (count > 0 && this._checkFinalizedTimer === false) {
          this._resetFinalizedTimer();
        }
      });
  }

  /**
   * clear checkExecuted timer
   */
  _cleanupExecutedTimer() {
    this._checkExecutedTimer && clearTimeout(this._checkExecutedTimer);
    this._checkExecutedTimer = null;
  }
  /**
   * clear checkConfirmed timer
   */
  _cleanupConfirmedTimer() {
    this._checkConfirmedTimer && clearTimeout(this._checkConfirmedTimer);
    this._checkConfirmedTimer = null;
  }
  /**
   * clear checkFinalized timer
   */
  _cleanupFinalizedTimer() {
    this._checkFinalizedTimer && clearTimeout(this._checkFinalizedTimer);
    this._checkFinalizedTimer = null;
  }

  /**
   * reset checkExecuted timer
   */
  _resetExecutedTimer() {
    console.log(`${this._logPrefix}: check executed timer is running`);
    this._cleanupExecutedTimer();
    this._checkExecutedTimer = setTimeout(() => {
      this._checkExecuted();
    }, DETAULT_EXECUTED_INTERVAL);
  }
  /**
   * reset checkConfirmed timer
   */
  _resetConfirmedTimer() {
    console.log(`${this._logPrefix}: check confirmed timer is running`);
    this._cleanupConfirmedTimer();
    this._checkConfirmedTimer = setTimeout(() => {
      this._checkConfirmed();
    }, DETAULT_CONFIRMED_INTERVAL);
  }
  /**
   * reset checkFinalized timer
   */
  _resetFinalizedTimer() {
    console.log(`${this._logPrefix}: check finalized timer is running`);
    this._cleanupFinalizedTimer();
    this._checkFinalizedTimer = setTimeout(() => {
      this._checkFinalized();
    }, DETAULT_FINALIZED_INTERVAL);
  }

  async _checkExecuted() {
    let stopTrack = false;
    this._cleanupExecutedTimer();
    try {
      if (!this._currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all pending txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(this._currentAddress.id, {
          inStatuses: [TxStatus.PENDING],
        }),
        this._currentAddress.network,
      ]);
      if (txs.length) {
        await this._checkStatus(txs, currentNetwork.endpoint);
      }
      // stop track when no pending tx
      stopTrack = txs.length === 0;
    } catch (error) {
      console.log(`${this._logPrefix}: `, error);
    } finally {
      if (stopTrack) {
        console.log(`${this._logPrefix}: stop executed track`);
        this._checkExecutedTimer = false;
      } else {
        this._resetExecutedTimer();
      }
    }
  }

  async _checkConfirmed() {
    let stopTrack = false;
    let status: TxStatus | undefined;
    this._cleanupConfirmedTimer();
    try {
      if (!this._currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all executed txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(this._currentAddress.id, {
          inStatuses: [TxStatus.EXECUTED],
        }),
        this._currentAddress.network,
      ]);
      const minNonceTx = await getMinNonceTx(txs);
      if (minNonceTx) {
        status = await this._checkStatus([minNonceTx], currentNetwork.endpoint);
      }
      // stop track when no executed tx
      stopTrack = !minNonceTx;
    } catch (error) {
      console.log(`${this._logPrefix}: `, error);
    } finally {
      if (stopTrack) {
        console.log(`${this._logPrefix}: stop confirmed track`);
        this._checkConfirmedTimer = false;
      } else {
        status === TxStatus.CONFIRMED || status === TxStatus.FINALIZED ? this._checkConfirmed() : this._resetConfirmedTimer();
      }
    }
  }

  async _checkFinalized() {
    let stopTrack = false;
    let status: TxStatus | undefined;
    this._cleanupFinalizedTimer();
    try {
      if (!this._currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all confirmed txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(this._currentAddress.id, {
          inStatuses: [TxStatus.CONFIRMED],
        }),
        this._currentAddress.network,
      ]);
      const minNonceTx = await getMinNonceTx(txs);
      if (minNonceTx) {
        status = await this._checkStatus([minNonceTx], currentNetwork.endpoint);
      }
      // stop track when no confirmed tx
      stopTrack = !minNonceTx;
    } catch (error) {
      console.log(`${this._logPrefix}: `, error);
    } finally {
      if (stopTrack) {
        console.log(`${this._logPrefix}: stop finalized track`);
        this._checkFinalizedTimer = false;
      } else {
        status === TxStatus.FINALIZED ? this._checkFinalized() : this._resetFinalizedTimer();
      }
    }
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
            t.err = 'replacedByAnotherTx';
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

  async _handleUnsent(tx: Tx, endpoint: string) {
    let resend = false;
    let replaced = false;
    try {
      await tx.updateSelf((tx) => {
        tx.status = TxStatus.UNSENT;
      });
      const nonce = (await tx.txPayload).nonce!;
      if (tx.resendCount && tx.resendCount >= CHECK_REPLACED_BEFORE_RESEND_COUNT) {
        const replaceReponse = await this._handleCheckReplaced(tx, nonce, endpoint);
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
      resend = true;
      const { error } = await this._handleResend(tx.raw, endpoint);
      console.log(`${this._logPrefix}: sendRawTransaction error`, error);
    } catch (error) {
      console.log(`${this._logPrefix}:`, error);
    } finally {
      tx.updateSelf((tx) => {
        tx.status = replaced ? TxStatus.REPLACED : TxStatus.PENDING;
        if (resend) {
          tx.resendCount = (tx.resendCount ?? 0) + 1;
          tx.resendAt = new Date();
        }
        if (replaced) {
          tx.raw = null;
          tx.err = 'replacedByAnotherTx';
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
        const { result: transaction } = await this._getTransactionByHash(tx.hash, endpoint);
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
      const { result: latestNonce, error } = await this._getNonce(address, endpoint);
      if (error) throw error;
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

  abstract _checkStatus(txs: Tx[], endpoint: string, returnStatus?: boolean): Promise<TxStatus | undefined>;
  abstract _handleResend(raw: string | null, endpoint: string): Promise<RPCResponse<string>>;
  abstract _getTransactionByHash(
    hash: string,
    endpoint: string,
  ): Promise<RPCResponse<ETH.eth_getTransactionByHashResponse | CFX.cfx_getTransactionByHashResponse>>;
  abstract _getNonce(address: string, endpoint: string): Promise<RPCResponse<string>>;
}
