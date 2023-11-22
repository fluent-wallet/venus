import { type Asset } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Asset>;
export function createAsset(params: Params, prepareCreate: true): Asset;
export function createAsset(params: Params): Promise<Asset>;
export function createAsset(params: Params, prepareCreate?: true) {
  return createModel<Asset>({ name: TableName.Asset, params, prepareCreate });
}
