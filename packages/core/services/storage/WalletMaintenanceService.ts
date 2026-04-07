import type { Database } from '@core/database';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { inject, injectable } from 'inversify';

const DEFAULT_CLEAR_TABLES: TableName[] = [
  TableName.AddressBook,
  TableName.Signature,
  TableName.TxExtra,
  TableName.TxPayload,
  TableName.Tx,
  TableName.Address,
  TableName.Permission,
  TableName.Account,
  TableName.AccountGroup,
  TableName.Vault,
  TableName.App,
  TableName.Request,
];

@injectable()
export class WalletMaintenanceService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  async clearWalletData(options: { tables?: TableName[] } = {}): Promise<void> {
    const tables = options.tables ?? DEFAULT_CLEAR_TABLES;

    const recordFetchingPromises = tables.map(async (tableName) => {
      const collection = this.database.get(tableName);
      const allRecords = await collection.query().fetch();
      return allRecords.map((record) => record.prepareDestroyPermanently());
    });

    const allDeletions = await Promise.all(recordFetchingPromises);
    const deletions = allDeletions.flat();

    await this.database.write(async () => {
      if (deletions.length) {
        await this.database.batch(...deletions);
      }
    });

    try {
      await this.database.localStorage.remove('SettleAuthentication');
    } catch {
      // ignore (legacy key)
    }
  }
}
