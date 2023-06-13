import database from '../Database';
import {Q} from '@nozbe/watermelondb';

export const fetchAllRecord = tableName => {
  return database.get(tableName).query().fetch();
};

export const getNetworks = async () => {
  return fetchAllRecord('network');
};

export const getAccountGroups = async () => {
  return fetchAllRecord('account_group');
};

export const getCurrentNetwork = async () => {
  return database.get('network').query(Q.where('selected', true));
};
