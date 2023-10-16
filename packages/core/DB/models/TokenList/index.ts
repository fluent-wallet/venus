import { Model, type Query } from '@nozbe/watermelondb';
import { text, children } from '@nozbe/watermelondb/decorators';
import { type Token } from '../Token';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';

export class TokenList extends Model {
  static table = TableName.TokenList;
  static associations = {
    [TableName.Token]: { type: 'has_many', foreignKey: 'token_list_id' },
  } as const;

  @text('url') url!: string;
  @text('name') name!: string;
  @text('value') value!: string | null;
  @children(TableName.Token) token!: Query<Token>;
}

type Params = ModelFields<TokenList>;
export function createTokenList(params: Params, prepareCreate: true): TokenList;
export function createTokenList(params: Params): Promise<TokenList>;
export function createTokenList(params: Params, prepareCreate?: true) {
  return createModel({ name: TableName.TokenList, params, prepareCreate });
}
