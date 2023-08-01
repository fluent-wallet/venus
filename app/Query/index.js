import database from '../Database';
import {Q} from '@nozbe/watermelondb';

export const fetchAllRecord = tableName => {
  return database.get(tableName).query().fetch();
};

export const fetchRecordByValue = (tableName, columnName, columnValue) => {
  return database.get(tableName).query(Q.where(columnName, columnValue));
};
export const getNetworks = async () => {
  return fetchAllRecord('network');
};

export const getAccountGroups = async () => {
  return fetchAllRecord('account_group');
};

export const getCurrentNetwork = async () => {
  return fetchRecordByValue('network', 'selected', true);
};

export const getAddressByValue = async value => {
  return fetchRecordByValue('address', 'address', value);
};

export const getAddressByValueAndNetworkId = async (value, network_id) => {
  const ret = await database
    .get('address')
    .query(
      Q.and(Q.where('value', value), Q.where('network_id', Q.eq(network_id))),
    )
    .fetch();
  return ret[0];
};

export const getTxByAddrAndHash = async (hash, address_id) => {
  return database
    .get('tx')
    .query(
      Q.and(Q.where('hash', hash), Q.where('address_id', Q.eq(address_id))),
    );
};

export const getAccountGroupVault = async accountGroupId => {
  const ag = await database.get('account_group').find(accountGroupId);
  const ret = await ag.vault.fetch();
  return ret;
};
