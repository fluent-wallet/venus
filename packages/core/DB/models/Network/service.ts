import { Q, type Query } from '@nozbe/watermelondb';
import { type Network } from './';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import type database from '../../';

export type NetworkParams = ModelFields<Network>;
export function createNetwork(params: NetworkParams, prepareCreate: true): Network;
export function createNetwork(params: NetworkParams): Promise<Network>;
export function createNetwork(params: NetworkParams, prepareCreate?: true) {
  return createModel<Network>({ name: TableName.Network, params, prepareCreate });
}

export const querySelectedNetwork = (_database: typeof database) =>
  _database.get(TableName.Network).query(Q.where('selected', true)) as unknown as Query<Network>;
