import { ModelFields, createModel } from '@DB/helper/modelHelper';
import { type Observable } from '@nozbe/watermelondb/utils/rx';
import { AccountGroup } from './';
import TableName from '../../TableName';
import database from '../../';

type Params = Omit<ModelFields<AccountGroup>, 'selectedAccount' | 'hiddenAccounts' | 'visibleAccounts'>;
export async function createAccountGroup(params: Params, prepareCreate?: true) {
  return createModel<AccountGroup>({
    name: TableName.AccountGroup,
    params: {
      ...params,
    },
    prepareCreate,
  });
}

export const observeAccountGroupById = (_database: typeof database, id: string) =>
  _database.get(TableName.AccountGroup).findAndObserve(id) as Observable<AccountGroup>;
