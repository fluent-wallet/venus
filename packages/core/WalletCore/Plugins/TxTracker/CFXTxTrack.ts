import { queryDuplicateTx, queryTxsWithAddress } from '@core/database/models/Tx/query';
import type { Tx } from '@core/database/models/Tx';
import type { Address } from '@core/database/models/Address';
import { NetworkType } from '@core/database/models/Network';
import { EXECUTED_NOT_FINALIZED_TX_STATUSES, ExecutedStatus, NOT_FINALIZED_TX_STATUSES, TxStatus } from '@core/database/models/Tx/type';
import { RPCResponse, RPCSend, RPCSendFactory } from '@core/utils/send';
import { firstValueFrom, debounceTime, Subscription } from 'rxjs';
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

export class CFXTxTrack {
  private _networkType = NetworkType.Conflux;
  private _latestNonceMap = new Map<string, string>();
  private _currentAddress: Address | null = null;
  private _checkExecutedTimer: NodeJS.Timeout | false | null = null;
  private _unexecutedSubscription: Subscription | null = null;
  private _checkConfirmedTimer: NodeJS.Timeout | false | null = null;
  private _unconfirmedSubscription: Subscription | null = null;
  private _checkFinalizedTimer: NodeJS.Timeout | false | null = null;
  private _unfinalizedSubscription: Subscription | null = null;

  constructor() {
    this._setup();
  }

  private _setup() {
    events.currentAddressObservable.pipe(debounceTime(40)).subscribe((selectedAddress) => {
      this._currentAddress = selectedAddress;
      if (!selectedAddress) {
        this._cleanup();
        console.log('CFXTxTrack: no selected address');
        return;
      }
      this._startup(selectedAddress);
    });
  }

  /**
   * start track && subscribe count change
   */
  private async _startup(address: Address) {
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
  private _cleanup() {
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
  private _subscribeUnexecutedTxCount(address: Address) {
    this._unexecutedSubscription?.unsubscribe();
    this._unexecutedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.PENDING],
    })
      .observeCount()
      .subscribe((count) => {
        console.log('CFXTxTrack: unexecuted-count', count);
        if (count > 0 && this._checkExecutedTimer === false) {
          this._resetExecutedTimer();
        }
      });
  }
  /**
   * subscribe unconfirmed txs count change
   */
  private _subscribeUnconfirmedTxCount(address: Address) {
    this._unconfirmedSubscription?.unsubscribe();
    this._unconfirmedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.EXECUTED],
    })
      .observeCount()
      .subscribe((count) => {
        console.log('CFXTxTrack: unconfirmed-count', count);
        if (count > 0 && this._checkConfirmedTimer === false) {
          this._resetConfirmedTimer();
        }
      });
  }
  /**
   * subscribe unfinalized txs count change
   */
  private _subscribeUnfinalizedTxCount(address: Address) {
    this._unfinalizedSubscription?.unsubscribe();
    this._unfinalizedSubscription = queryTxsWithAddress(address.id, {
      inStatuses: [TxStatus.CONFIRMED],
    })
      .observeCount()
      .subscribe((count) => {
        console.log('CFXTxTrack: unfinalized-count', count);
        if (count > 0 && this._checkFinalizedTimer === false) {
          this._resetFinalizedTimer();
        }
      });
  }

  /**
   * clear checkExecuted timer
   */
  private _cleanupExecutedTimer() {
    this._checkExecutedTimer && clearTimeout(this._checkExecutedTimer);
    this._checkExecutedTimer = null;
  }
  /**
   * clear checkConfirmed timer
   */
  private _cleanupConfirmedTimer() {
    this._checkConfirmedTimer && clearTimeout(this._checkConfirmedTimer);
    this._checkConfirmedTimer = null;
  }
  /**
   * clear checkFinalized timer
   */
  private _cleanupFinalizedTimer() {
    this._checkFinalizedTimer && clearTimeout(this._checkFinalizedTimer);
    this._checkFinalizedTimer = null;
  }

  /**
   * reset checkExecuted timer
   */
  private _resetExecutedTimer() {
    console.log('CFXTxTrack: check executed timer is running');
    this._cleanupExecutedTimer();
    this._checkExecutedTimer = setTimeout(() => {
      this._checkExecuted();
    }, DETAULT_EXECUTED_INTERVAL);
  }
  /**
   * reset checkConfirmed timer
   */
  private _resetConfirmedTimer() {
    console.log('CFXTxTrack: check confirmed timer is running');
    this._cleanupConfirmedTimer();
    this._checkConfirmedTimer = setTimeout(() => {
      this._checkConfirmed();
    }, DETAULT_CONFIRMED_INTERVAL);
  }
  /**
   * reset checkFinalized timer
   */
  private _resetFinalizedTimer() {
    console.log('CFXTxTrack: check finalized timer is running');
    this._cleanupFinalizedTimer();
    this._checkFinalizedTimer = setTimeout(() => {
      this._checkFinalized();
    }, DETAULT_FINALIZED_INTERVAL);
  }

  private async _checkExecuted() {
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
      console.log('CFXTxTrack: ', error);
    } finally {
      if (stopTrack) {
        console.log('CFXTxTrack: stop executed track');
        this._checkExecutedTimer = false;
      } else {
        this._resetExecutedTimer();
      }
    }
  }

  private async _checkConfirmed() {
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
      console.log('CFXTxTrack: ', error);
    } finally {
      if (stopTrack) {
        console.log('CFXTxTrack: stop confirmed track');
        this._checkConfirmedTimer = false;
      } else {
        status === TxStatus.CONFIRMED || status === TxStatus.FINALIZED ? this._checkConfirmed() : this._resetConfirmedTimer();
      }
    }
  }

  private async _checkFinalized() {
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
      console.log('CFXTxTrack: ', error);
    } finally {
      if (stopTrack) {
        console.log('CFXTxTrack: stop finalized track');
        this._checkFinalizedTimer = false;
      } else {
        status === TxStatus.FINALIZED ? this._checkFinalized() : this._resetFinalizedTimer();
      }
    }
  }

  private async _checkStatus(txs: Tx[], endpoint: string, returnStatus = false): Promise<TxStatus | undefined> {
    let status: TxStatus | undefined;
    const RPCSend = RPCSendFactory(endpoint);
    const getTransactionByHashParams = txs.map((tx) => ({ method: 'cfx_getTransactionByHash', params: [tx.hash] }));
    const getTransactionByHashResponses = await firstValueFrom(RPCSend<RPCResponse<CFX.cfx_getTransactionByHashResponse>[]>(getTransactionByHashParams));
    const executedTxs = txs.filter((tx, index) => {
      const { result: transaction, error } = getTransactionByHashResponses[index];
      if (error) {
        console.log('CFXTxTrack: getTransactionByHash error:', {
          hash: tx.hash,
          error,
        });
        return false;
      }
      if (!transaction) {
        this._handleUnsent(tx, endpoint);
        if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
          this._handleDuplicateTx(tx, false, false);
        }
        returnStatus && (status = TxStatus.UNSENT);
        return false;
      }
      //  the transaction is skipped or not packed
      if (transaction.status !== '0x1' && transaction.status !== '0x0') {
        returnStatus && (status = TxStatus.PENDING);
        tx.updateSelf((tx) => {
          tx.status = TxStatus.PENDING;
          tx.executedStatus = null;
          tx.receipt = null;
          tx.pollingCount = (tx.pollingCount ?? 0) + 1;
        }).then(() => {
          if (EXECUTED_NOT_FINALIZED_TX_STATUSES.includes(tx.status)) {
            this._handleDuplicateTx(tx, false, false);
          }
        });
        return false;
      }
      return true;
    });
    if (executedTxs.length) {
      const getTransactionReceiptParams = executedTxs.map((tx) => ({ method: 'cfx_getTransactionReceipt', params: [tx.hash] }));
      const getTransactionReceiptResponses = await firstValueFrom(RPCSend<RPCResponse<CFX.cfx_getTransactionReceiptResponse>[]>(getTransactionReceiptParams));
      const receiptMap = new Map<string, CFX.cfx_getTransactionReceiptResponse>();
      const hasReceiptTxs = executedTxs.filter((tx, index) => {
        const { result: receipt, error } = getTransactionReceiptResponses[index];
        if (error) {
          console.log('CFXTxTrack: getTransactionReceipt error:', {
            hash: tx.hash,
            error,
          });
          return false;
        }
        if (!receipt) return false;
        returnStatus && (status = TxStatus.EXECUTED);
        receiptMap.set(tx.hash, receipt);
        return true;
      });
      const getBlockByHashParams = hasReceiptTxs.map((tx) => ({ method: 'cfx_getBlockByHash', params: [receiptMap.get(tx.hash)!.blockHash, false] }));
      getBlockByHashParams.unshift({ method: 'cfx_getStatus', params: [] });
      const [statusResponse, ...getBlockByHashParamsResponses] = await firstValueFrom(
        RPCSend<[RPCResponse<CFX.cfx_getStatusResponse>, ...RPCResponse<CFX.cfx_getBlockByHashResponse>[]]>(getBlockByHashParams),
      );
      let latestBlockNumber: bigint | undefined;
      let safeBlockNumber: bigint | undefined;
      let finalizedBlockNumber: bigint | undefined;
      if (statusResponse.result?.latestState) {
        latestBlockNumber = BigInt(statusResponse.result.latestState);
      }
      if (statusResponse.result?.latestConfirmed) {
        safeBlockNumber = BigInt(statusResponse.result.latestConfirmed);
      }
      if (statusResponse.result?.latestFinalized) {
        finalizedBlockNumber = BigInt(statusResponse.result.latestFinalized);
      }
      await Promise.all(
        hasReceiptTxs.map(async (tx, index) => {
          const { result: block, error } = getBlockByHashParamsResponses[index];
          if (error) {
            console.log('CFXTxTrack: getBlockByHash error:', {
              hash: tx.hash,
              error,
            });
            return false;
          }
          let txStatus = TxStatus.EXECUTED;
          const receipt = receiptMap.get(tx.hash)!;
          const txBlockNumber = BigInt(receipt.epochNumber!);
          let confirmedNumber = 0;
          console.log('CFXTxTrack: blockNumber', txBlockNumber, finalizedBlockNumber, safeBlockNumber, latestBlockNumber);
          if (finalizedBlockNumber && txBlockNumber <= finalizedBlockNumber) {
            txStatus = TxStatus.FINALIZED;
            returnStatus && (status = TxStatus.FINALIZED);
          } else if (safeBlockNumber && txBlockNumber <= safeBlockNumber) {
            txStatus = TxStatus.CONFIRMED;
            returnStatus && (status = TxStatus.CONFIRMED);
          }
          if (latestBlockNumber) {
            confirmedNumber = Math.max(0, Number(latestBlockNumber - txBlockNumber));
          }
          await tx.updateSelf((tx) => {
            if (txStatus === TxStatus.FINALIZED) {
              tx.raw = null;
            }
            tx.status = txStatus;
            tx.executedStatus = receipt.outcomeStatus === '0x0' ? ExecutedStatus.SUCCEEDED : ExecutedStatus.FAILED;
            tx.receipt = {
              blockHash: receipt.blockHash,
              transactionIndex: receipt.index,
              blockNumber: receipt.epochNumber,
              gasUsed: receipt.gasUsed,
              gasFee: receipt.gasFee,
              storageCollateralized: receipt.storageCollateralized,
              gasCoveredBySponsor: receipt.gasCoveredBySponsor,
              storageCoveredBySponsor: receipt.storageCoveredBySponsor,
              storageReleased: receipt.storageReleased?.length ? receipt.storageReleased : undefined,
              contractCreated: receipt.contractCreated,
            };
            if (block.timestamp) {
              tx.executedAt = new Date(Number(BigInt(block.timestamp)) * 1000);
            }
            if (receipt.outcomeStatus !== '0x0') {
              tx.err = receipt.txExecErrorMsg ?? 'tx failed';
            }
            tx.pollingCount = (tx.pollingCount ?? 0) + 1;
            tx.confirmedNumber = confirmedNumber;
          });
          if (tx.status !== txStatus) {
            this._handleDuplicateTx(tx, true, txStatus === TxStatus.FINALIZED);
            if (txStatus === TxStatus.EXECUTED) {
              this._updateTokenBalance(tx);
            }
          }
        }),
      );
    }
    return status;
  }

  private async _handleDuplicateTx(tx: Tx, isReplaced = true, finalized = true) {
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
      console.log('CFXTxTrack: ', error);
    }
  }

  private async _updateTokenBalance(tx: Tx) {
    try {
      const [txExtra, txPayload] = await Promise.all([tx.txExtra, tx.txPayload]);
      if (txExtra.tokenNft) {
        plugins.NFTDetailTracker.updateCurrentOpenNFT(txPayload.to);
      }
      if (txExtra.simple || txExtra.token20) {
        plugins.AssetsTracker.updateCurrentTracker().catch((err) => console.log('CFXTxTrack: ', err));
      }
    } catch (error) {
      console.log('CFXTxTrack: ', error);
    }
  }

  private async _handleUnsent(tx: Tx, endpoint: string) {
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
        console.log('CFXTxTrack: tx resend limit reached:', tx.hash);
        return;
      }
      const duplicateTxs = await queryDuplicateTx(tx, nonce);
      const latestDuplicateTx = duplicateTxs?.[0];
      if (latestDuplicateTx && latestDuplicateTx.createdAt > tx.createdAt) {
        console.log('CFXTxTrack: tx has speedup or canceled:', tx.hash);
        return;
      }
      resend = true;
      const { error } = await firstValueFrom(RPCSend<RPCResponse<string>>(endpoint, { method: 'cfx_sendRawTransaction', params: [tx.raw] }));
      console.log('CFXTxTrack: sendRawTransaction error', error);
    } catch (error) {
      console.log('CFXTxTrack:', error);
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

  private async _handleCheckReplaced(tx: Tx, nonce: number, endpoint: string): Promise<ReplacedResponse> {
    try {
      const nonceUsed = await this._handleCheckNonceUsed(tx, nonce, endpoint);
      if (!nonceUsed) {
        return ReplacedResponse.NotReplaced;
      } else {
        const { result: transaction } = await firstValueFrom(
          RPCSend<RPCResponse<CFX.cfx_getTransactionByHashResponse>>(endpoint, { method: 'cfx_getTransactionByHash', params: [tx.hash] }),
        );
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
  private async _handleCheckNonceUsed(tx: Tx, nonce: number, endpoint: string) {
    try {
      const prevLatestNonce = this._latestNonceMap.get(tx.address.id);
      if (prevLatestNonce && Number(prevLatestNonce) > Number(nonce)) {
        return true;
      }
      const address = await (await tx.address).getValue();
      const { result: latestNonce } = await firstValueFrom(
        // TODO: ???
        RPCSend<RPCResponse<string>>(endpoint, { method: 'cfx_getNextNonce', params: [address] }),
      );
      latestNonce && this._latestNonceMap.set(tx.address.id, latestNonce);
      if (Number(latestNonce) > Number(nonce)) {
        return true;
      }
      return false;
    } catch (error) {
      console.log('CFXTxTrack error:', error);
      return false;
    }
  }
}
