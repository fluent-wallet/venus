import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { queryTxsWithAddress } from '@core/database/models/Tx/query';
import type { TxStatus } from '@core/database/models/Tx/type';
import type { Subscription } from 'rxjs';
import CFXTxTracker from './CFXTxTrack';
import EthTxTracker from './EthTxTrack';
import database from '@core/database';
import type { UpdaterMap } from './BaseTxTrack';

const txTrackerMap = {
  [EthTxTracker.networkType]: EthTxTracker,
  [CFXTxTracker.networkType]: CFXTxTracker,
};
const getMinNonceTxs = async (txs: Tx[]) => {
  if (!txs.length) {
    return;
  }
  const payloads = await Promise.all(txs.map((tx) => tx.txPayload));
  let minNonce = payloads[0].nonce!;
  let minNonceTx = [txs[0]];
  for (let i = 1; i < txs.length; i++) {
    const payload = payloads[i];
    if (payload.nonce! < minNonce) {
      minNonceTx = [txs[i]];
      minNonce = payload.nonce!;
    } else if (payload.nonce! === minNonce) {
      minNonceTx.push(txs[i]);
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
   * start polling && subscribe count change
   */
  startup(address: Address) {
    this._currentAddress = address;
    this._pollingTimer = null;
    this._polling();
    this._subscribeTxCount(address);
  }
  /**
   * stop polling && unsubscribe count change
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
        // stop polling when no selected address
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
      const minNonceTxs = await getMinNonceTxs(txs);
      if (minNonceTxs?.length) {
        const updaterMap: UpdaterMap = new Map();
        status = await tracker._checkStatus(minNonceTxs, currentNetwork, updaterMap);
        if (updaterMap.size > 0) {
          await database.write(() => {
            const updates: Tx[] = [];
            for (const updater of updaterMap.values()) {
              updates.push(updater());
            }
            return database.batch(updates);
          });
        }
      } else {
        // stop polling when no tx
        stopTrack = true;
      }
    } catch (error) {
      console.log(`${this._key} polling: `, error);
    } finally {
      if (stopTrack) {
        console.log(`${this._key} polling: stop polling`);
        this._pollingTimer = false;
      } else {
        this.startNextPollingImmediately(status) ? this._polling() : this._resetPollingTimer();
      }
    }
  }
}
