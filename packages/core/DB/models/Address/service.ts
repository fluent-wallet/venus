import { type Account } from '../Account';
import { type Network } from '../Network';
import { type Address } from './';
import TableName from '../../TableName';
import { createModel } from '../../helper/modelHelper';
import { encode } from '../../../utils/address';
import { toAccountAddress } from '../../../utils/account';

type Params = { hex: string; nativeBalance?: string; account: Account; network: Network };
export function createAddress(params: Params, prepareCreate: true): Address;
export function createAddress(params: Params): Promise<Address>;
export function createAddress({ hex, nativeBalance, network, account }: Params, prepareCreate?: true) {
  if (!network) throw new Error('Network is required in createAddress.');
  if (!account) throw new Error('Account is required in createAddress.');

  return createModel<Address>({
    name: TableName.Address,
    params: { hex, nativeBalance: nativeBalance ?? '0x0', base32: network ? encode(toAccountAddress(hex), network.netId) : '', account },
    prepareCreate,
  });
}
