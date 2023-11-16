import { ModelFields, createModel } from '../../helper/modelHelper';
import { type Observable } from '@nozbe/watermelondb/utils/rx';
import { AccountGroup } from '.';
import TableName from '../../TableName';
import database from '../..';

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

export const observeAccountGroupById = (accountGroupId: string) =>
  database.get(TableName.AccountGroup).findAndObserve(accountGroupId) as Observable<AccountGroup>;
