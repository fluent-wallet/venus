import { type Network } from './';
import TableName from '../../TableName';
import { createModel, type ModelFields } from '../../helper/modelHelper';

export type NetworkParams = ModelFields<Network>;
export function createNetwork(params: NetworkParams, prepareCreate: true): Network;
export function createNetwork(params: NetworkParams): Promise<Network>;
export function createNetwork(params: NetworkParams, prepareCreate?: true) {
  return createModel<Network>({ name: TableName.Network, params, prepareCreate });
}
