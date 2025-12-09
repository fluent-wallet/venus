import { memoize } from 'lodash-es';
import type { Observable } from 'rxjs';
import database from '../..';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { AccountGroup } from '.';

type Params = Omit<ModelFields<AccountGroup>, 'hiddenAccounts' | 'visibleAccounts' | 'observeSelectedAccount'>;
export function createAccountGroup(params: Params, prepareCreate: true): AccountGroup;
export function createAccountGroup(params: Params): Promise<AccountGroup>;
export function createAccountGroup(params: Params, prepareCreate?: true) {
  return createModel<AccountGroup>({
    name: TableName.AccountGroup,
    params: {
      ...params,
    },
    prepareCreate,
  });
}

export const observeAccountGroupById = memoize(
  (accountGroupId: string) => database.get(TableName.AccountGroup).findAndObserve(accountGroupId) as Observable<AccountGroup>,
);

export const queryAccountGroupById = async (id: string) => database.get(TableName.AccountGroup).find(id) as Promise<AccountGroup>;
