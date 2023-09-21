// import {Platform} from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import * as models from './model';
export * from './model';

export enum TableName {
  HdPath = 'hd_path',
  Network = 'network',
  Token = 'token',
  Ticker = 'ticker',
  TokenList = 'token_list',
  Address = 'address',
  TokenBalance = 'token_balance',
  Tx = 'tx',
  TxExtra = 'tx_extra',
  TxPayload = 'tx_payload',
  AccountGroup = 'account_group',
  Vault = 'vault',
  Account = 'account',
  Memo = 'memo',
}

const adapter = new SQLiteAdapter({
  dbName: 'venus_database2',
  schema,
  migrations,
  // RN not support synchronous mode yet(ps: jsi === true means enable synchronous mode).see below:
  // https://github.com/facebook/react-native/issues/26705
  // https://github.com/Nozbe/WatermelonDB/issues/813
  // This bug may only appear in debug mode.We will continue to watch...
  jsi: false, // jsi: Platform.OS === 'ios',
});

const database = new Database({
  adapter,
  modelClasses: [...Object.values(models)],
});

export default database;
