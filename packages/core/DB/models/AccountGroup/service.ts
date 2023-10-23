import { ModelFields, createModel } from '@core/DB/helper/modelHelper';
import { AccountGroup } from './';
import TableName from '../../TableName';

type Params = ModelFields<AccountGroup>;
export async function createAccountGroup(params: Params, prepareCreate?: true) {
  return createModel<AccountGroup>({
    name: TableName.AccountGroup,
    params: {
      ...params,
    },
    prepareCreate,
  });
}