import type { Query } from '@nozbe/watermelondb';
import { convertToChecksum } from '../../../utils/account';
import database from '../..';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { Asset } from '.';

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
