import type { AssetRule } from '.';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

type Params = ModelFields<AssetRule>;
export function createAssetRule(params: Params, prepareCreate: true): AssetRule;
export function createAssetRule(params: Params): Promise<AssetRule>;
export function createAssetRule(params: Params, prepareCreate?: true) {
  return createModel<AssetRule>({ name: TableName.AssetRule, params, prepareCreate });
}
