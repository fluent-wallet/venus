import database from '../';
import TableName from '../TableName';

export async function clearTables(tableNames: Array<TableName>) {
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

const clearAccountData = async () => {
  try {
    await clearTables([
      TableName.Address,
      TableName.Account,
      TableName.AccountGroup,
      TableName.Vault,
      TableName.Tx,
      TableName.Ticker,
      TableName.TxExtra,
      TableName.TxPayload,
      TableName.TokenBalance,
    ]);
  } catch (error) {
    console.error('Clear account data error', error);
    throw error;
  }
};

export default clearAccountData;
