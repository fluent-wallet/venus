import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import TableName from '@core/database/TableName';
import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { NOT_FINALIZED_TX_STATUSES } from '@core/database/models/Tx/type';
import type { IChainProvider } from '@core/types';
import { TxSyncEngine } from './TxSyncEngine';

export type TxSyncServiceOptions = {
  db: Database;
  engine: TxSyncEngine;
  now: () => number;
};

export class TxSyncService {
  private readonly db: Database;
  private readonly engine: TxSyncEngine;
  private readonly now: () => number;

  constructor(options: TxSyncServiceOptions) {
    this.db = options.db;
    this.engine = options.engine;
    this.now = options.now;
  }

  async refreshKey(params: {
    addressId: string;
    networkId: string;
    provider: IChainProvider;
    maxResendCount?: number; // default Infinity
  }): Promise<void> {
    const { addressId, provider } = params;

    const address = await this.db.get<Address>(TableName.Address).find(addressId);

    const txModels = await this.queryTxsByAddress(addressId);
    const minGroup = await this.pickMinNonceGroup(txModels);
    if (minGroup.length === 0) return;

    const addressValue = await address.getValue();

    const snapshots = await Promise.all(
      minGroup.map(async (tx) => {
        const payload = await tx.txPayload;
        return {
          txId: tx.id,
          status: tx.status,
          nonce: payload.nonce ?? -1,
          hash: tx.hash ?? null,
          raw: tx.raw,
          resendCount: tx.resendCount ?? 0,
          createdAtMs: tx.createdAt.getTime(),
        };
      }),
    );

    const filtered = snapshots.filter((s) => s.nonce >= 0);
    if (filtered.length === 0) return;

    const result = await this.engine.run({
      txs: filtered,
      provider,
      addressValue,
      now: this.now,
      maxResendCount: params.maxResendCount ?? Number.POSITIVE_INFINITY,
    });

    if (result.patches.length === 0) return;

    const byId = new Map(txModels.map((t) => [t.id, t]));

    await this.db.write(async () => {
      const ops: Tx[] = [];

      for (const patch of result.patches) {
        const tx = byId.get(patch.txId);
        if (!tx) continue;

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
  }
  private async queryTxsByAddress(addressId: string): Promise<Tx[]> {
    return await this.db
      .get<Tx>(TableName.Tx)
      .query(Q.where('address_id', addressId), Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(NOT_FINALIZED_TX_STATUSES)))
      .fetch();
  }

  private async pickMinNonceGroup(txs: Tx[]): Promise<Tx[]> {
    if (txs.length === 0) return [];

    const payloads = await Promise.all(txs.map((tx) => tx.txPayload));
    let min: number | null = null;

    for (const p of payloads) {
      if (typeof p.nonce !== 'number') continue;
      if (min === null || p.nonce < min) min = p.nonce;
    }
    if (min === null) return [];

    const group: Tx[] = [];
    for (let i = 0; i < txs.length; i += 1) {
      if (payloads[i]?.nonce === min) group.push(txs[i]);
    }
    return group;
  }

  async scanActiveKeys(): Promise<Array<{ addressId: string; networkId: string }>> {
    const rows = await this.db
      .get<Tx>(TableName.Tx)
      .query(Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(NOT_FINALIZED_TX_STATUSES)))
      .fetch();

    const seen = new Map<string, { addressId: string; networkId: string }>();

    for (const tx of rows) {
      const address = await tx.address.fetch();
      const network = await address.network.fetch();

      const key = { addressId: tx.address.id, networkId: network.id };
      const id = `${key.addressId}:${key.networkId}`;
      if (!seen.has(id)) seen.set(id, key);
    }

    return Array.from(seen.values());
  }
}
