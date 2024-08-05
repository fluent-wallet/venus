import events from '@core/WalletCore/Events';
import methods from '@core/WalletCore/Methods';
import type { Address } from '@core/database/models/Address';
import { queryTxsWithAddress } from '@core/database/models/Tx/query';
import { TxStatus } from '@core/database/models/Tx/type';
import { DETAULT_PENDING_POLLING_INTERVAL, DETAULT_EXECUTED_POLLING_INTERVAL, DETAULT_CONFIRMED_POLLING_INTERVAL } from '@core/utils/consts';
import { debounceTime } from 'rxjs';
import type { Plugin } from '../';
import { Polling } from './polling';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    TxTracker: TxTrackerPluginClass;
  }
}

class TxTrackerPluginClass implements Plugin {
  public name = 'TxTracker';
  _currentAddress: Address | null = null;
  _pendingPolling = new Polling({
    inStatuses: [TxStatus.DISCARDED, TxStatus.PENDING],
    pollingInterval: DETAULT_PENDING_POLLING_INTERVAL,
    key: 'pending',
    startNextPollingImmediately: (status) => status !== TxStatus.DISCARDED && status !== TxStatus.PENDING,
  });
  _executedPolling = new Polling({
    inStatuses: [TxStatus.EXECUTED],
    pollingInterval: DETAULT_EXECUTED_POLLING_INTERVAL,
    key: 'executed',
    startNextPollingImmediately: (status) => status === TxStatus.CONFIRMED || status === TxStatus.FINALIZED,
  });
  _confirmedPolling = new Polling({
    inStatuses: [TxStatus.CONFIRMED],
    pollingInterval: DETAULT_CONFIRMED_POLLING_INTERVAL,
    key: 'confirmed',
    startNextPollingImmediately: (status) => status === TxStatus.FINALIZED,
  });
  _tempReplacedPolling = new Polling({
    inStatuses: [TxStatus.TEMP_REPLACED],
    pollingInterval: DETAULT_CONFIRMED_POLLING_INTERVAL,
    key: 'tempReplaced',
    startNextPollingImmediately: (status) => status !== TxStatus.TEMP_REPLACED,
  });

  constructor() {
    this._setup();
  }

  private _setup() {
    events.broadcastTransactionSubject.subscribe(async (value) => {
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
      nextNonce && this._handleWaittingTx(nextNonce);
    });
  }

  /**
   * start track && subscribe count change
   */
  async _startup(address: Address) {
    this._currentAddress = address;
    this._pendingPolling.startup(address);
    this._executedPolling.startup(address);
    this._confirmedPolling.startup(address);
    this._tempReplacedPolling.startup(address);
  }
  /**
   * stop track && unsubscribe count change
   */
  _cleanup() {
    this._currentAddress = null;
    this._pendingPolling.cleanup();
    this._executedPolling.cleanup();
    this._confirmedPolling.cleanup();
    this._tempReplacedPolling.cleanup();
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
