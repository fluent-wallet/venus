import { Q, type Query } from '@nozbe/watermelondb';
import { type Account } from '../Account';
import { type Network } from '../Network';
import { type AssetRule } from '../AssetRule';
import { type Address } from '.';
import TableName from '../../TableName';
import { createModel } from '../../helper/modelHelper';
import { encode } from '../../../utils/address';
import { toAccountAddress } from '../../../utils/account';
import database from '../..';

type Params = { hex: string; nativeBalance?: string; account: Account; network: Network; assetRule: AssetRule };
export function createAddress(params: Params, prepareCreate: true): Address;
export function createAddress(params: Params): Promise<Address>;
export function createAddress({ hex, nativeBalance, network, account, assetRule }: Params, prepareCreate?: true) {
  if (!network) throw new Error('Network is required in createAddress.');
  if (!account) throw new Error('Account is required in createAddress.');
  if (!assetRule) throw new Error('assetRule is required in createAddress.');

  return createModel<Address>({
    name: TableName.Address,
    params: { hex, nativeBalance: nativeBalance ?? '0x0', base32: network ? encode(toAccountAddress(hex), network.netId) : '', account, network, assetRule },
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
