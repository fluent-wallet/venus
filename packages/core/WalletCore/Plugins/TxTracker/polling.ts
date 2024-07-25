import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { queryTxsWithAddress } from '@core/database/models/Tx/query';
import type { TxStatus } from '@core/database/models/Tx/type';
import type { Subscription } from 'rxjs';
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

interface PollingParams {
  inStatuses: TxStatus[];
  pollingInterval: number;
  key: string;
  startNextPollingImmediately: (status?: TxStatus) => boolean;
}

export class Polling {
  private _currentAddress: Address | null = null;
  private _pollingTimer: NodeJS.Timeout | false | null = null;
  private _txCountSubscription: Subscription | null = null;
  private _inStatuses: TxStatus[];
  private _pollingInterval: number;
  private _key: string;
  startNextPollingImmediately: (status?: TxStatus) => boolean;
  constructor({ inStatuses, pollingInterval, key, startNextPollingImmediately }: PollingParams) {
    this._inStatuses = inStatuses;
    this._pollingInterval = pollingInterval;
    this._key = key;
    this.startNextPollingImmediately = startNextPollingImmediately;
  }

  /**
   * start track && subscribe count change
   */
  startup(address: Address) {
    this._currentAddress = address;
    this._polling();
    this._subscribeTxCount(address);
  }
  /**
   * stop track && unsubscribe count change
   */
  cleanup() {
    this._currentAddress = null;
    this._cleanupPollingTimer();
    this._txCountSubscription?.unsubscribe();
    this._txCountSubscription = null;
  }

  /**
   * subscribe txs count change
   */
  private _subscribeTxCount(address: Address) {
    this._txCountSubscription?.unsubscribe();
    this._txCountSubscription = queryTxsWithAddress(address.id, {
      inStatuses: this._inStatuses,
    })
      .observeCount(false)
      .subscribe((count) => {
        console.log(`${this._key} polling: tx-count`, count);
        if (count > 0 && this._pollingTimer === false) {
          this._resetPollingTimer();
        }
      });
  }

  /**
   * clear polling timer
   */
  private _cleanupPollingTimer() {
    this._pollingTimer && clearTimeout(this._pollingTimer);
    this._pollingTimer = null;
  }

  /**
   * reset polling timer
   */
  private _resetPollingTimer() {
    console.log(`${this._key} polling: timer is running`);
    this._cleanupPollingTimer();
    this._pollingTimer = setTimeout(() => {
      this._polling();
    }, this._pollingInterval);
  }

  async _polling() {
    let stopTrack = false;
    let status: TxStatus | undefined;
    this._cleanupPollingTimer();
    try {
      const currentAddress = this._currentAddress;
      if (!currentAddress) {
        // stop track when no selected address
        stopTrack = true;
        throw new Error(`${this._key} polling: No selected address`);
      }
      // query all txs with selectedAddress
      const [txs, currentNetwork] = await Promise.all([
        queryTxsWithAddress(currentAddress.id, {
          inStatuses: this._inStatuses,
        }),
        currentAddress.network,
      ]);
      const tracker = txTrackerMap[currentNetwork.networkType];
      const minNonceTx = await getMinNonceTx(txs);
      // stop track when no tx
      stopTrack = !minNonceTx;
      if (minNonceTx) {
        status = await tracker._checkStatus([minNonceTx], currentNetwork);
      }
    } catch (error) {
      console.log(`${this._key} polling: `, error);
    } finally {
      if (stopTrack) {
        console.log(`${this._key} polling: stop polling track`);
        this._pollingTimer = false;
      } else {
        this.startNextPollingImmediately(status) ? this._polling() : this._resetPollingTimer();
      }
    }
  }
}
