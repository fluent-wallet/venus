import { Q, type Query } from '@nozbe/watermelondb';
import { memoize } from 'lodash-es';
import type { Observable } from 'rxjs';
import { toAccountAddress } from '../../../utils/account';
import { convertHexToBase32, encode, toHex, validateCfxAddress, validateHexAddress } from '../../../utils/address';
import database from '../..';
import { createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { Account } from '../Account';
import type { AssetRule } from '../AssetRule';
import { type Network, NetworkType } from '../Network';
import type { Address } from '.';

type Params = { hex: string; account: Account; network: Network; assetRule: AssetRule };
export function createAddress(params: Params, prepareCreate: true): Address;
export function createAddress(params: Params): Promise<Address>;
export function createAddress({ hex, network, account, assetRule }: Params, prepareCreate?: true) {
  if (!network) throw new Error('Network is required in createAddress.');
  if (!account) throw new Error('Account is required in createAddress.');
  if (!assetRule) throw new Error('assetRule is required in createAddress.');

  return createModel<Address>({
    name: TableName.Address,
    params: { hex, base32: network ? convertHexToBase32(hex, network.netId) : '', account, network, assetRule },
    prepareCreate,
  });
}

export const querySelectedAddress = () =>
  database
    .get(TableName.Address)
    .query(
      Q.experimentalJoinTables([TableName.Account, TableName.Network]),
      Q.and(Q.on(TableName.Account, Q.where('selected', true)), Q.on(TableName.Network, Q.where('selected', true))),
    ) as unknown as Query<Address>;

export const observeSelectedAddress = () => querySelectedAddress().observe();
export const queryAddressById = async (id: string) => database.get(TableName.Address).find(id) as Promise<Address>;
export const queryAllAddresses = () => database.get(TableName.Address).query() as unknown as Query<Address>;
export const observeAddressById = memoize((id: string) => database.get(TableName.Address).findAndObserve(id) as Observable<Address>);

export const getAddressValueByNetwork = (address: string, network: Network) => {
  if (validateHexAddress(address)) {
    return network.networkType === NetworkType.Conflux ? convertHexToBase32(address, network.netId) : address;
  }
  if (validateCfxAddress(address)) {
    return network.networkType === NetworkType.Conflux ? address : toHex(address);
  }
  return address;
};
