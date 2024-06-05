import { injectable, inject } from 'inversify';
import database, { dbRefresh$ } from '../../database';
import TableName from '../../database/TableName';
import { createHdPath } from '../../database/models/HdPath/query';
import { NetworkMethod } from './networkMethod';
import { DEFAULT_CFX_HDPATH, DEFAULT_ETH_HDPATH, Networks } from '../../utils/consts';
const NetworksArr = Object.entries(Networks).map(([_, network]) => network);

const HD_PATH_ARR = [
  { name: 'cfx-default', value: DEFAULT_CFX_HDPATH },
  { name: 'eth-default', value: DEFAULT_ETH_HDPATH },
] as const;

async function clearTables(tableNames: Array<TableName>) {
  const recordFetchingPromises = tableNames.map(async (tableName) => {
    const collection = database.get(tableName);
    const allRecords = await collection.query().fetch();
    return allRecords.map((record) => record.prepareDestroyPermanently());
  });

  const allDeletions = await Promise.all(recordFetchingPromises);
  const deletions = allDeletions.flat();

  await database.write(async () => {
    await database.batch(...deletions);
  });
}

@injectable()
export class DatabaseMethod {
  @inject(NetworkMethod) private NetworkMethod!: NetworkMethod;

  async initDatabaseDefault() {
    try {
      // Should skip if the DB has already been initialized.
      if ((await database.get(TableName.HdPath).query().fetchCount()) !== 0) {
        return true;
      }

      await database.write(async () => {
        const hdPaths = HD_PATH_ARR.map((params) => createHdPath(params, true));
        const networks = await Promise.all(
          NetworksArr.map(async ({ hdPathIndex, ...params }) => {
            return await this.NetworkMethod.createNetwork(
              {
                ...params,
                ...(typeof hdPathIndex === 'number' ? { hdPath: hdPaths[hdPathIndex] } : null),
              },
              true,
            );
          }),
        );
        await database.batch(...hdPaths, ...(Array.isArray(networks) ? networks.flat() : []));
      });
      return true;
    } catch (error) {
      console.error('Init Database error', error);
      return false;
    }
  }

  async clearAccountData() {
    try {
      await clearTables([
        TableName.Address,
        TableName.Account,
        TableName.AccountGroup,
        TableName.Vault,
        TableName.TxExtra,
        TableName.TxPayload,
        TableName.Tx,
        TableName.App,
        TableName.Permission,
        TableName.Request,
      ]);
      await database.localStorage.remove('SettleAuthentication');
      dbRefresh$.next(null);
    } catch (error) {
      console.error('Clear account data error', error);
      throw error;
    }
  }

  initDatabase: () => void = null!;
  async resetDatabase() {
    try {
      await database.write(async () => {
        await database.unsafeResetDatabase();
        await database.localStorage.remove('SettleAuthentication');
      });
      if (this.initDatabase) {
        await this.initDatabase();
      } else {
        await this.initDatabaseDefault();
      }
      dbRefresh$.next(null);
    } catch (error) {
      console.error('Reset database error', error);
    }
  }
}
