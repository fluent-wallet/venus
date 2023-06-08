import database from '../Database';

export const fetchAllRecord = tableName => {
  return database.get(tableName).query().fetch();
};

export const getNetworks = async () => {
  return fetchAllRecord('network');
};

export const getAccountGroups = async () => {
  return fetchAllRecord('account_group');
};
