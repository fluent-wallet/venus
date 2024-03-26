import { Q, type Query } from '@nozbe/watermelondb';
import { type Asset } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';

export type AssetParams = Omit<ModelFields<Asset>, 'hashKey'>;
export function createAsset(params: AssetParams, prepareCreate: true): Asset;
export function createAsset(params: AssetParams): Promise<Asset>;
export function createAsset(params: AssetParams, prepareCreate?: true) {
  return createModel<Asset>({ name: TableName.Asset, params, prepareCreate });
}

export const queryAssetByAddress = (address: string) => database.get(TableName.Asset).query(Q.where('contract_address', address)) as unknown as Query<Asset>;
export const queryAllAssets = () => database.get(TableName.Request).query() as unknown as Query<Asset>;
