import { Account as AccountModel } from './Account';
import { AccountGroup as AccountGroupModel } from './AccountGroup';
import { Address as AddressModel } from './Address';
import { AddressBook as AddressBookModel } from './AddressBook';
import { App as AppModel } from './App';
import { Asset as AssetModel } from './Asset';
import { AssetRule as AssetRuleModel } from './AssetRule';
import { HdPath as HdPathModel } from './HdPath';
import { Network as NetworkModel } from './Network';
import { Permission as PermissionModel } from './Permission';
import { Request as RequestModel } from './Request';
import { Signature as SignatureModel } from './Signature';
import { Tx as TxModel } from './Tx';
import { TxExtra as TxExtraModel } from './TxExtra';
import { TxPayload as TxPayloadModel } from './TxPayload';
import { Vault as VaultModel } from './Vault';

export const modelClasses = [
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
