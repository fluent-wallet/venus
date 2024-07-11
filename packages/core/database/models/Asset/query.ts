import type { Query } from '@nozbe/watermelondb';
import type { Asset } from '.';
import database from '../..';
import { convertToChecksum } from '../../../utils/account';
import TableName from '../../TableName';
import { type ModelFields, createModel } from '../../helper/modelHelper';

export type AssetParams = Omit<ModelFields<Asset>, 'hashKey'>;
export function createAsset(params: AssetParams, prepareCreate: true): Asset;
export function createAsset(params: AssetParams): Promise<Asset>;
export function createAsset(params: AssetParams, prepareCreate?: true) {
  return createModel<Asset>({
    name: TableName.Asset,
    params: { ...params, contractAddress: convertToChecksum(params.contractAddress) },
    prepareCreate,
  });
}

export const queryAllAssets = () => database.get(TableName.Request).query() as unknown as Query<Asset>;
