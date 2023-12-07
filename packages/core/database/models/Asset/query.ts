import { Q, type Query } from '@nozbe/watermelondb';
import { type Asset } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import database from '../..';

type Params = ModelFields<Asset>;
export function createAsset(params: Params, prepareCreate: true): Asset;
export function createAsset(params: Params): Promise<Asset>;
export function createAsset(params: Params, prepareCreate?: true) {
  return createModel<Asset>({ name: TableName.Asset, params, prepareCreate });
}

export const queryAssetByAddress = (address: string) =>
  database
    .get(TableName.Asset)
    .query(
      Q.where('asset_address', address)
    ) as unknown as Query<Asset>;
