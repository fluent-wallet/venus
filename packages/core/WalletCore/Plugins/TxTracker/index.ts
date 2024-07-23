import events from '@core/WalletCore/Events';
import { broadcastTransactionSubject } from '@core/WalletCore/Events/broadcastTransactionSubject';
import methods from '@core/WalletCore/Methods';
import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { queryTxsWithAddress } from '@core/database/models/Tx/query';
import { TxStatus } from '@core/database/models/Tx/type';
import { DETAULT_CONFIRMED_INTERVAL, DETAULT_EXECUTED_INTERVAL, DETAULT_FINALIZED_INTERVAL } from '@core/utils/consts';
import { type Subscription, debounceTime } from 'rxjs';
import type { Plugin } from '../';
import CFXTxTracker from './CFXTxTrack';
import EthTxTracker from './EthTxTrack';

const txTrackerMap = {
  [EthTxTracker.networkType]: EthTxTracker,
  [CFXTxTracker.networkType]: CFXTxTracker,
};
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

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    TxTracker: TxTrackerPluginClass;
  }
}

class TxTrackerPluginClass implements Plugin {
  public name = 'TxTracker';
  _currentAddress: Address | null = null;
  _checkExecutedTimer: NodeJS.Timeout | false | null = null;
  _unexecutedSubscription: Subscription | null = null;
  _checkConfirmedTimer: NodeJS.Timeout | false | null = null;
  _unconfirmedSubscription: Subscription | null = null;
  _checkFinalizedTimer: NodeJS.Timeout | false | null = null;
  _unfinalizedSubscription: Subscription | null = null;

  constructor() {
    this._setup();
  }

  private _setup() {
    broadcastTransactionSubject.subscribe(async (value) => {
      value && methods.createTx(value);
    });
    events.currentAddressObservable.pipe(debounceTime(40)).subscribe(async (selectedAddress) => {
      if (!selectedAddress) {
        this._cleanup();
        console.log('TxTracker: no selected address');
        return;
      }
      this._startup(selectedAddress);
    });
    events.nextNonceSubject.subscribe(async (nextNonce) => {
      this._handleWaittingTx(nextNonce);
    });
  }

  /**
   * start track && subscribe count change
   */
  async _startup(address: Address) {
    this._currentAddress = address;
    this._checkExecuted();
    this._subscribeUnexecutedTxCount(address);
    this._checkConfirmed();
    this._subscribeUnconfirmedTxCount(address);
    this._checkFinalized();
    this._subscribeUnfinalizedTxCount(address);
  }
  /**
   * stop track && unsubscribe count change
   */
  _cleanup() {
    this._currentAddress = null;
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
      .observeCount(false)
      .subscribe((count) => {
        console.log('TxTracker: unexecuted-count', count);
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
      .observeCount(false)
      .subscribe((count) => {
        console.log('TxTracker: unconfirmed-count', count);
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
      .observeCount(false)
      .subscribe((count) => {
        console.log('TxTracker: unfinalized-count', count);
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
    console.log('TxTracker: check executed timer is running');
    this._cleanupExecutedTimer();
    this._checkExecutedTimer = setTimeout(() => {
      this._checkExecuted();
    }, DETAULT_EXECUTED_INTERVAL);
  }
  /**
   * reset checkConfirmed timer
   */
  _resetConfirmedTimer() {
    console.log('TxTracker: check confirmed timer is running');
    this._cleanupConfirmedTimer();
    this._checkConfirmedTimer = setTimeout(() => {
      this._checkConfirmed();
    }, DETAULT_CONFIRMED_INTERVAL);
  }
  /**
   * reset checkFinalized timer
   */
  _resetFinalizedTimer() {
    console.log('TxTracker: check finalized timer is running');
    this._cleanupFinalizedTimer();
    this._checkFinalizedTimer = setTimeout(() => {
      this._checkFinalized();
    }, DETAULT_FINALIZED_INTERVAL);
  }

  async _checkExecuted() {
    let stopTrack = false;
    let status: TxStatus | undefined;
    this._cleanupExecutedTimer();
    try {
      const currentAddress = this._currentAddress;
      if (!currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all pending txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(currentAddress.id, {
          inStatuses: [TxStatus.PENDING],
        }),
        currentAddress.network,
      ]);
      const tracker = txTrackerMap[currentNetwork.networkType];
      const minNonceTx = await getMinNonceTx(txs);
      // stop track when no pending tx
      stopTrack = !minNonceTx;
      if (minNonceTx) {
        status = await tracker._checkStatus([minNonceTx], currentNetwork);
      }
    } catch (error) {
      console.log('TxTracker: ', error);
    } finally {
      if (stopTrack) {
        console.log('TxTracker: stop executed track');
        this._checkExecutedTimer = false;
      } else {
        status === TxStatus.EXECUTED || status === TxStatus.CONFIRMED || status === TxStatus.FINALIZED ? this._checkExecuted() : this._resetExecutedTimer();
      }
    }
  }

  async _checkConfirmed() {
    let stopTrack = false;
    let status: TxStatus | undefined;
    this._cleanupConfirmedTimer();
    try {
      const currentAddress = this._currentAddress;
      if (!currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all executed txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(currentAddress.id, {
          inStatuses: [TxStatus.EXECUTED],
        }),
        currentAddress.network,
      ]);
      const tracker = txTrackerMap[currentNetwork.networkType];
      const minNonceTx = await getMinNonceTx(txs);
      // stop track when no executed tx
      stopTrack = !minNonceTx;
      if (minNonceTx) {
        status = await tracker._checkStatus([minNonceTx], currentNetwork);
      }
    } catch (error) {
      console.log('TxTracker: ', error);
    } finally {
      if (stopTrack) {
        console.log('TxTracker: stop confirmed track');
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
      const currentAddress = this._currentAddress;
      if (!currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error('No selected address');
      }
      // query all confirmed txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(currentAddress.id, {
          inStatuses: [TxStatus.CONFIRMED],
        }),
        currentAddress.network,
      ]);
      const tracker = txTrackerMap[currentNetwork.networkType];
      const minNonceTx = await getMinNonceTx(txs);
      // stop track when no confirmed tx
      stopTrack = !minNonceTx;
      if (minNonceTx) {
        status = await tracker._checkStatus([minNonceTx], currentNetwork);
      }
    } catch (error) {
      console.log('TxTracker: ', error);
    } finally {
      if (stopTrack) {
        console.log('TxTracker: stop finalized track');
        this._checkFinalizedTimer = false;
      } else {
        status === TxStatus.FINALIZED ? this._checkFinalized() : this._resetFinalizedTimer();
      }
    }
  }

  async _handleWaittingTx(_nextNonce: string) {
    try {
      const currentAddress = this._currentAddress;
      if (!currentAddress) {
        throw new Error('No selected address');
      }
      // query all waitting txs with selectedAddress
      const txs = await queryTxsWithAddress(currentAddress.id, {
        inStatuses: [TxStatus.WAITTING],
      });
      const nextNonce = BigInt(_nextNonce);
      for (const tx of txs) {
        const payload = await tx.txPayload;
        if (BigInt(payload.nonce!) <= nextNonce) {
          tx.updateSelf((_tx) => {
            _tx.status = TxStatus.PENDING;
          });
        }
      }
    } catch (error) {
      console.log('TxTracker: ', error);
    }
  }
}

export default new TxTrackerPluginClass();
