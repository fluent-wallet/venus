import { type AssetRule } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<AssetRule>;
export function createAssetRule(params: Params, prepareCreate: true): AssetRule;
export function createAssetRule(params: Params): Promise<AssetRule>;
export function createAssetRule(params: Params, prepareCreate?: true) {
  return createModel<AssetRule>({ name: TableName.AssetRule, params, prepareCreate });
}
