import { Q, type Query } from '@nozbe/watermelondb';
import { map, type Observable } from 'rxjs';
import { memoize } from 'lodash-es';
import { type Vault } from '.';
import database from '../..';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import VaultType from './VaultType';

export type Params = Omit<ModelFields<Vault>, 'isGroup' | 'observeAccountGroup'>;
export function createVault(params: Params, prepareCreate: true): Vault;
export function createVault(params: Params): Promise<Vault>;
export function createVault(params: Params, prepareCreate?: true) {
  return createModel<Vault>({
    name: TableName.Vault,
    params,
    prepareCreate,
  });
}

export const checkIsFirstVault = async () => {
  const count = await database.get(TableName.Vault).query().fetchCount();
  return count === 0;
};

export const getVaultTypeCount = (type: Vault['type']) => database.get(TableName.Vault).query(Q.where('type', type)).fetchCount();

export const observeBSIMCreated = () =>
  (database.get(TableName.Vault).query(Q.where('type', 'BSIM')) as unknown as Query<Vault>).observeCount().pipe(map((count) => count > 0));

export const observeVaultById = memoize((vaultId: string) => database.get(TableName.Vault).findAndObserve(vaultId) as Observable<Vault>);

export const getEncryptedVault = () =>
  database
    .get<Vault>(TableName.Vault)
    .query(Q.where('type', Q.oneOf([VaultType.PrivateKey, VaultType.HierarchicalDeterministic])))
    .fetch();

export const getEncryptedVaultWithBSIM = () =>
  database
    .get<Vault>(TableName.Vault)
    .query(Q.where('type', Q.oneOf([VaultType.PrivateKey, VaultType.HierarchicalDeterministic, VaultType.BSIM])))
    .fetch();
