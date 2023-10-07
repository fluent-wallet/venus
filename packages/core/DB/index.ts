// import {Platform} from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import migrations from './migrations';
import { Account as AccountModel } from './models/Account';
import { AccountGroup as AccountGroupModel } from './models/AccountGroup';
import { Address as AddressModel } from './models/Address';
import { HdPath as HdPathModel } from './models/HdPath';
import { Memo as MemoModel } from './models/Memo';
import { Network as NetworkModel } from './models/Network';
import { Ticker as TickerModel } from './models/Ticker';
import { Token as TokenModel } from './models/Token';
import { TokenBalance as TokenBalanceModel } from './models/TokenBalance';
import { TokenList as TokenListModel } from './models/TokenList';
import { Tx as TxModel } from './models/Tx';
import { TxExtra as TxExtraModel } from './models/TxExtra';
import { TxPayload as TxPayloadModel } from './models/TxPayload';
import { Vault as VaultModel } from './models/Vault';

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

export const modelClasses = [
  AccountModel,
  AccountGroupModel,
  AddressModel,
  HdPathModel,
  MemoModel,
  NetworkModel,
  TickerModel,
  TokenModel,
  TokenBalanceModel,
  TokenListModel,
  TxModel,
  TxExtraModel,
  TxPayloadModel,
  VaultModel,
];

const database = new Database({
  adapter,
  modelClasses,
});

export default database;