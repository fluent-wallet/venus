import { Database as _Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Subject } from 'rxjs';
import migrations from './migrations';
import { Account as AccountModel } from './models/Account';
import { AccountGroup as AccountGroupModel } from './models/AccountGroup';
import { Address as AddressModel } from './models/Address';
import { App as AppModel } from './models/App';
import { Asset as AssetModel } from './models/Asset';
import { AssetRule as AssetRuleModel } from './models/AssetRule';
import { HdPath as HdPathModel } from './models/HdPath';
import { Network as NetworkModel } from './models/Network';
import { Permission as PermissionModel } from './models/Permission';
import { Request as RequestModel } from './models/Request';
import { Signature as SignatureModel } from './models/Signature';
import { Tx as TxModel } from './models/Tx';
import { TxExtra as TxExtraModel } from './models/TxExtra';
import { TxPayload as TxPayloadModel } from './models/TxPayload';
import { Vault as VaultModel } from './models/Vault';
import { AddressBook as AddressBookModel } from './models/AddressBook';
import schema from './schema';
export const dbRefresh$ = new Subject();
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

const modelClasses = [
  VaultModel,
  AccountGroupModel,
  AccountModel,
  AddressModel,
  HdPathModel,
  NetworkModel,
  AssetModel,
  AssetRuleModel,
  SignatureModel,
  TxModel,
  TxExtraModel,
  TxPayloadModel,
  AppModel,
  PermissionModel,
  RequestModel,
  AddressBookModel,
];

const database = new _Database({
  adapter,
  modelClasses,
});

export type Database = typeof database;
export default database;
