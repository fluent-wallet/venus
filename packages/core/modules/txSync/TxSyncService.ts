import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { NOT_FINALIZED_TX_STATUSES, TxStatus } from '@core/database/models/Tx/type';
import TableName from '@core/database/TableName';
import type { IChainProvider } from '@core/types';
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { CoreEventMap, EventBus } from '../eventBus';
import type { TxSyncEngine, TxSyncTxPatch, TxSyncTxSnapshot } from './TxSyncEngine';

const HIGH_PRIORITY_TX_STATUSES = new Set<TxStatus>([TxStatus.WAITTING, TxStatus.DISCARDED, TxStatus.PENDING]);
const BACKGROUND_TX_STATUSES = new Set<TxStatus>([TxStatus.EXECUTED, TxStatus.CONFIRMED, TxStatus.TEMP_REPLACED]);

export type TxSyncPollKind = 'high' | 'background' | 'idle';

export type TxSyncRefreshResult = {
  nextPollKind: TxSyncPollKind;
  hasHighPriorityWork: boolean;
  hasBackgroundWork: boolean;
  processedFamilyCount: number;
  updatedTxIds: string[];
};

export type TxSyncActiveKey = {
  key: { addressId: string; networkId: string };
  nextPollKind: Exclude<TxSyncPollKind, 'idle'>;
};

type TxSyncFamilyPlan = {
  nonce: number;
  lane: Exclude<TxSyncPollKind, 'idle'>;
  snapshots: TxSyncTxSnapshot[];
};

export type TxSyncServiceOptions = {
  db: Database;
  engine: TxSyncEngine;
  now: () => number;
  eventBus?: EventBus<CoreEventMap>;
};

export class TxSyncService {
  private readonly db: Database;
  private readonly engine: TxSyncEngine;
  private readonly now: () => number;
  private readonly eventBus?: EventBus<CoreEventMap>;

  constructor(options: TxSyncServiceOptions) {
    this.db = options.db;
    this.engine = options.engine;
    this.now = options.now;
    this.eventBus = options.eventBus;
  }

  private summarizeWorkStatuses(statuses: Iterable<TxStatus>): Pick<TxSyncRefreshResult, 'nextPollKind' | 'hasHighPriorityWork' | 'hasBackgroundWork'> {
    let hasHighPriorityWork = false;
    let hasBackgroundWork = false;

    for (const status of statuses) {
      if (HIGH_PRIORITY_TX_STATUSES.has(status)) {
        hasHighPriorityWork = true;
        continue;
      }

      if (BACKGROUND_TX_STATUSES.has(status)) {
        hasBackgroundWork = true;
      }
    }

    const nextPollKind: TxSyncPollKind = hasHighPriorityWork ? 'high' : hasBackgroundWork ? 'background' : 'idle';
    return { nextPollKind, hasHighPriorityWork, hasBackgroundWork };
  }

  private classifyFamilyLane(statuses: Iterable<TxStatus>): Exclude<TxSyncPollKind, 'idle'> {
    return this.summarizeWorkStatuses(statuses).hasHighPriorityWork ? 'high' : 'background';
  }

  async refreshKey(params: {
    addressId: string;
    networkId: string;
    provider: IChainProvider;
    maxResendCount?: number; // default Infinity
  }): Promise<TxSyncRefreshResult> {
    const { addressId, provider } = params;

    const address = await this.db.get<Address>(TableName.Address).find(addressId);

    const txModels = await this.queryTxsByAddress(addressId);

    const familyPlans = await this.buildFamilyPlans(txModels);
    if (familyPlans.length === 0) {
      const summary = this.summarizeWorkStatuses(txModels.map((tx) => tx.status));
      return {
        ...summary,
        processedFamilyCount: 0,
        updatedTxIds: [],
      };
    }

    const addressValue = await address.getValue();
    // Process a single family per pass so background finality work cannot block active pending lanes on the same key.
    const nextFamily = familyPlans[0];
    const result = await this.engine.run({
      txs: nextFamily.snapshots,
      provider,
      addressValue,
      now: this.now,
      maxResendCount: params.maxResendCount ?? Number.POSITIVE_INFINITY,
    });

    const patchById = new Map<string, TxSyncTxPatch['set']>();
    for (const patch of result.patches) {
      const previous = patchById.get(patch.txId) ?? {};
      patchById.set(patch.txId, { ...previous, ...patch.set });
    }

    const patches = Array.from(patchById.entries()).map(([txId, set]) => ({ txId, set }));

    if (patches.length === 0) {
      const summary = this.summarizeWorkStatuses(txModels.map((tx) => tx.status));
      return {
        ...summary,
        processedFamilyCount: 1,
        updatedTxIds: [],
      };
    }

    const byId = new Map(txModels.map((t) => [t.id, t]));
    const updatedTxIds: string[] = [];

    await this.db.write(async () => {
      const ops: Tx[] = [];

      for (const patch of patches) {
        const tx = byId.get(patch.txId);
        if (!tx) continue;

        updatedTxIds.push(patch.txId);
        ops.push(
          tx.prepareUpdate((record) => {
            const set = patch.set;

            if (set.status !== undefined) record.status = set.status;
            if (set.raw !== undefined) record.raw = set.raw;

            if (set.executedStatus !== undefined) record.executedStatus = set.executedStatus;
            if (set.receipt !== undefined) record.receipt = set.receipt;
            if (set.executedAt !== undefined) record.executedAt = set.executedAt;

            if (set.err !== undefined) record.err = set.err;
            if (set.errorType !== undefined) record.errorType = set.errorType;

            if (set.resendAt !== undefined) record.resendAt = set.resendAt;
            if (set.resendCount !== undefined) record.resendCount = set.resendCount;

            if (set.isTempReplacedByInner !== undefined) record.isTempReplacedByInner = set.isTempReplacedByInner;
          }),
        );
      }

      if (ops.length > 0) await this.db.batch(...ops);
    });

    if (updatedTxIds.length > 0) {
      this.eventBus?.emit('tx/updated', {
        key: { addressId: params.addressId, networkId: params.networkId },
        txIds: updatedTxIds,
        timestampMs: this.now(),
      });
    }

    const effectiveStatuses = txModels.map((tx) => patchById.get(tx.id)?.status ?? tx.status);
    const summary = this.summarizeWorkStatuses(effectiveStatuses);

    return {
      ...summary,
      processedFamilyCount: 1,
      updatedTxIds,
    };
  }

  private async queryTxsByAddress(addressId: string): Promise<Tx[]> {
    return await this.db
      .get<Tx>(TableName.Tx)
      .query(Q.where('address_id', addressId), Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(NOT_FINALIZED_TX_STATUSES)))
      .fetch();
  }

  private async buildFamilyPlans(txs: Tx[]): Promise<TxSyncFamilyPlan[]> {
    if (txs.length === 0) return [];

    const payloads = await Promise.all(txs.map((tx) => tx.txPayload));
    const families = new Map<number, TxSyncTxSnapshot[]>();

    for (let i = 0; i < txs.length; i += 1) {
      const tx = txs[i];
      const payload = payloads[i];
      if (typeof payload?.nonce !== 'number') continue;

      const snapshot: TxSyncTxSnapshot = {
        txId: tx.id,
        status: tx.status,
        nonce: payload.nonce,
        hash: tx.hash ?? null,
        raw: tx.raw,
        epochHeight: payload.epochHeight ?? null,
        resendCount: tx.resendCount ?? 0,
        createdAtMs: tx.createdAt.getTime(),
      };

      const family = families.get(payload.nonce) ?? [];
      family.push(snapshot);
      families.set(payload.nonce, family);
    }

    const highPriorityFamilies: TxSyncFamilyPlan[] = [];
    const backgroundFamilies: TxSyncFamilyPlan[] = [];

    for (const [nonce, snapshots] of families.entries()) {
      const lane = this.classifyFamilyLane(snapshots.map((snapshot) => snapshot.status));
      const plan = { nonce, lane, snapshots };

      if (lane === 'high') {
        highPriorityFamilies.push(plan);
      } else {
        backgroundFamilies.push(plan);
      }
    }

    highPriorityFamilies.sort((a, b) => a.nonce - b.nonce);
    backgroundFamilies.sort((a, b) => a.nonce - b.nonce);

    return [...highPriorityFamilies, ...backgroundFamilies];
  }

  async scanActiveKeys(): Promise<TxSyncActiveKey[]> {
    const rows = await this.db
      .get<Tx>(TableName.Tx)
      .query(Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(NOT_FINALIZED_TX_STATUSES)))
      .fetch();

    const seen = new Map<string, { addressId: string; networkId: string; statuses: TxStatus[] }>();

    for (const tx of rows) {
      const address = await tx.address.fetch();
      const network = await address.network.fetch();

      const key = { addressId: tx.address.id, networkId: network.id };
      const id = `${key.addressId}:${key.networkId}`;
      const existing = seen.get(id);
      if (!existing) {
        seen.set(id, { ...key, statuses: [tx.status] });
        continue;
      }

      existing.statuses.push(tx.status);
    }

    return Array.from(seen.values())
      .map((entry) => {
        const summary = this.summarizeWorkStatuses(entry.statuses);
        if (summary.nextPollKind === 'idle') return null;

        return {
          key: { addressId: entry.addressId, networkId: entry.networkId },
          nextPollKind: summary.nextPollKind,
        };
      })
      .filter((entry): entry is TxSyncActiveKey => !!entry);
  }
}
