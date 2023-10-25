import { type Ticker } from './';
import { ModelFields, createModel } from '@DB/helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Ticker>;
export function createTicker(params: Params, prepareCreate: true): Ticker;
export function createTicker(params: Params): Promise<Ticker>;
export function createTicker(params: Params, prepareCreate?: true) {
  return createModel<Ticker>({ name: TableName.Ticker, params, prepareCreate });
}
