import { type TokenList } from './';
import { ModelFields, createModel } from '@core/DB/helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<TokenList>;
export function createTokenList(params: Params, prepareCreate: true): TokenList;
export function createTokenList(params: Params): Promise<TokenList>;
export function createTokenList(params: Params, prepareCreate?: true) {
  return createModel({ name: TableName.TokenList, params, prepareCreate });
}
