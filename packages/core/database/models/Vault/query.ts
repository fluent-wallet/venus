import { Q, type Query } from '@nozbe/watermelondb';
import { map, type Observable } from 'rxjs';
import { memoize } from 'lodash-es';
import { type Vault } from '.';
import VaultType from './VaultType';
import database from '../..';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';

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

export const checkNoSameVault = async (data: string) => {
  return (
    (await database
      .get<Vault>(TableName.Vault)
      .query(Q.where('type', Q.oneOf([VaultType.PrivateKey, VaultType.HierarchicalDeterministic])), Q.where('data', data))
      .fetchCount()) === 0
  );
};

export const observeBSIMCreated = () =>
  (database.get(TableName.Vault).query(Q.where('type', 'BSIM')) as unknown as Query<Vault>).observeCount().pipe(map((count) => count > 0));

export const observeVaultById = memoize((vaultId: string) => database.get(TableName.Vault).findAndObserve(vaultId) as Observable<Vault>);
