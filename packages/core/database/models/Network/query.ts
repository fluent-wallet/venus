import { Q, type Query } from '@nozbe/watermelondb';
import { memoize } from 'lodash-es';
import type { Observable } from 'rxjs';
import database from '../..';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { Network } from '.';

export type NetworkParams = Omit<
  ModelFields<Network>,
  'nativeAsset' | 'nativeAssetQuery' | 'defaultAssetRuleQuery' | 'defaultAssetRule' | 'queryAssetByAddress'
>;
export function createNetwork(params: NetworkParams, prepareCreate: true): Network;
export function createNetwork(params: NetworkParams): Promise<Network>;
export function createNetwork(params: NetworkParams, prepareCreate?: true) {
  return createModel<Network>({ name: TableName.Network, params, prepareCreate });
}

export const querySelectedNetwork = () => database.get(TableName.Network).query(Q.where('selected', true)) as unknown as Query<Network>;
export const queryNetworkById = async (id: string) => database.get(TableName.Network).find(id) as Promise<Network>;
export const queryNetworkByChainId = async (chainId: string) => {
  const networks = await database.get(TableName.Network).query(Q.where('chain_identification', chainId));
  return networks?.[0] as Network;
};
export const queryNetworkByNetId = async (netId: number) => {
  const networks = await database.get(TableName.Network).query(Q.where('net_identification', netId));
  return networks?.[0] as Network;
};

export const observeNetworkById = memoize((networkId: string) => database.get(TableName.Network).findAndObserve(networkId) as Observable<Network>);

export const queryNetworks = async () => {
  const networks = await database.get<Network>(TableName.Network).query();
  return networks;
};
