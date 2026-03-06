import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { App } from '@core/database/models/App';
import type { Network } from '@core/database/models/Network';
import type { Signature } from '@core/database/models/Signature';
import type { Tx } from '@core/database/models/Tx';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CoreError, SIGNATURE_RECORD_ADDRESS_NOT_FOUND, SIGNATURE_RECORD_NETWORK_NOT_FOUND } from '@core/errors';
import { ChainStatusService } from '@core/services/chain/ChainStatusService';
import { NetworkType } from '@core/types';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable } from 'inversify';
import { fromNumber } from 'ox/Hex';
import { type ISignatureRecord, SignatureFilterOption, type SignatureRecordAppSnapshot, type SignatureRecordTxSnapshot, type SignType } from './types';

export type CreateSignatureRecordInput = {
  addressId: string;
  signType: SignType;
  message?: string | null;
  app?: { identity: string; origin?: string; name?: string; icon?: string } | null;
};

@injectable()
export class SignatureRecordService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(ChainStatusService)
  private readonly chainStatus!: ChainStatusService;

  async createRecord(input: CreateSignatureRecordInput): Promise<string> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    const blockNumber = await this.getBlockNumberHex(network);

    const existingApp = input.app?.identity ? await this.findAppByIdentity(input.app.identity) : null;
    const preparedApp = !existingApp && input.app?.identity ? this.prepareApp(input.app) : null;

    const signature = this.database.get<Signature>(TableName.Signature).prepareCreate((record) => {
      record.address.set(address);
      record.signType = input.signType;
      record.message = input.message ?? null;
      record.blockNumber = blockNumber;

      if (existingApp) {
        record.app.set(existingApp);
      } else if (preparedApp) {
        record.app.set(preparedApp);
      }
    });

    await this.database.write(async () => {
      await this.database.batch(...(preparedApp ? [preparedApp] : []), signature);
    });

    return signature.id;
  }

  async linkTx(params: { signatureId: string; txId: string }): Promise<void> {
    try {
      await this.database.write(async () => {
        const signature = await this.database.get<Signature>(TableName.Signature).find(params.signatureId);
        const tx = await this.database.get<Tx>(TableName.Tx).find(params.txId);

        await signature.update((record) => {
          record.tx.set(tx);
        });
      });
    } catch {
      // do not block tx pipeline.
    }
  }

  async countRecords(params: { addressId: string; filter?: SignatureFilterOption }): Promise<number> {
    const clauses: Q.Clause[] = [Q.where('address_id', params.addressId)];
    const filter = params.filter ?? SignatureFilterOption.All;
    if (filter !== SignatureFilterOption.All) {
      clauses.push(Q.where('tx_id', filter === SignatureFilterOption.Transactions ? Q.notEq(null) : Q.eq(null)));
    }
    return this.database
      .get<Signature>(TableName.Signature)
      .query(...clauses)
      .fetchCount();
  }

  async listRecords(params: { addressId: string; filter?: SignatureFilterOption; limit?: number; offset?: number }): Promise<ISignatureRecord[]> {
    const clauses: Q.Clause[] = [Q.where('address_id', params.addressId)];

    const filter = params.filter ?? SignatureFilterOption.All;
    if (filter !== SignatureFilterOption.All) {
      clauses.push(Q.where('tx_id', filter === SignatureFilterOption.Transactions ? Q.notEq(null) : Q.eq(null)));
    }

    // Avoid sorting by hex string blockNumber (lexicographic != numeric). Use createdAt as the primary order key.
    clauses.push(Q.sortBy('created_at', Q.desc), Q.sortBy('block_number', Q.desc));

    if (typeof params.limit === 'number') clauses.push(Q.take(params.limit));
    if (typeof params.offset === 'number') clauses.push(Q.skip(params.offset));

    const rows = await this.database
      .get<Signature>(TableName.Signature)
      .query(...clauses)
      .fetch();

    const appIds = Array.from(new Set(rows.map((s) => s.app.id).filter((id): id is string => typeof id === 'string' && id.length > 0)));
    const txIds = Array.from(new Set(rows.map((s) => s.tx.id).filter((id): id is string => typeof id === 'string' && id.length > 0)));

    const apps = appIds.length
      ? await this.database
          .get<App>(TableName.App)
          .query(Q.where('id', Q.oneOf(appIds)))
          .fetch()
      : [];
    const txs = txIds.length
      ? await this.database
          .get<Tx>(TableName.Tx)
          .query(Q.where('id', Q.oneOf(txIds)))
          .fetch()
      : [];

    const appMap = new Map<string, SignatureRecordAppSnapshot>(apps.map((app) => [app.id, { id: app.id, origin: app.origin ?? '', icon: app.icon ?? null }]));
    const txMap = new Map<string, SignatureRecordTxSnapshot>(txs.map((tx) => [tx.id, { id: tx.id, method: tx.method }]));

    return rows.map((s) => this.toSnapshot(s, { appMap, txMap }));
  }

  private toSnapshot(
    signature: Signature,
    refs: { appMap: ReadonlyMap<string, SignatureRecordAppSnapshot>; txMap: ReadonlyMap<string, SignatureRecordTxSnapshot> },
  ): ISignatureRecord {
    const appId = signature.app.id || null;
    const txId = signature.tx.id || null;

    return {
      id: signature.id,
      addressId: signature.address.id,
      appId,
      txId,
      app: appId ? (refs.appMap.get(appId) ?? null) : null,
      tx: txId ? (refs.txMap.get(txId) ?? null) : null,
      signType: signature.signType,
      message: signature.message ?? null,
      blockNumber: signature.blockNumber,
      createdAt: signature.createdAt.getTime(),
    };
  }

  private async findAddress(addressId: string): Promise<Address> {
    try {
      return await this.database.get<Address>(TableName.Address).find(addressId);
    } catch {
      throw new CoreError({
        code: SIGNATURE_RECORD_ADDRESS_NOT_FOUND,
        message: 'Address not found in database.',
        context: { addressId },
      });
    }
  }

  private async getNetwork(address: Address): Promise<Network> {
    const network = await address.network.fetch();
    if (!network) {
      throw new CoreError({
        code: SIGNATURE_RECORD_NETWORK_NOT_FOUND,
        message: 'Address has no associated network.',
        context: { addressId: address.id },
      });
    }
    return network;
  }

  private async findAppByIdentity(identity: string): Promise<App | null> {
    if (!identity) return null;
    try {
      const res = await this.database.get<App>(TableName.App).query(Q.where('identity', identity)).fetch();
      return res?.[0] ?? null;
    } catch {
      return null;
    }
  }

  private prepareApp(input: { identity: string; origin?: string; name?: string; icon?: string }): App {
    return this.database.get<App>(TableName.App).prepareCreate((record) => {
      record.identity = input.identity;
      record.origin = input.origin;
      record.name = input.name ?? input.identity;
      record.icon = input.icon;
    });
  }

  private async getBlockNumberHex(network: Network): Promise<string> {
    try {
      const chain = { chainId: network.chainId, networkType: network.networkType };

      let height: bigint;

      switch (network.networkType) {
        case NetworkType.Ethereum:
          height = await this.chainStatus.getBlockNumber(chain);
          return fromNumber(height);

        case NetworkType.Conflux:
          height = await this.chainStatus.getEpochHeight(chain);
          return fromNumber(height);

        default:
          return '0x0';
      }
    } catch {
      return '0x0';
    }
  }
}
