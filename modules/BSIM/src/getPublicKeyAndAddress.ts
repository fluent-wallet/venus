import { getAddress, keccak256 } from 'ethers';
import type { PubkeyRecord } from './core/types';
import type { ApduFlowError } from './core/workflows';
import type { BSIMError } from './errors';
import type { TransportError } from './transports/errors';
import { getWallet } from './walletInstance';

export type PublicKeyAndAddress503Type = {
  coinType: number;
  address?: never;
  index: number;
  key: string;
};
export type PublicKeyAndAddress60Type = {
  coinType: number;
  address: string;
  index: number;
  key: string;
};
export type GetPublicKeyAndAddressReturnType = PublicKeyAndAddress503Type | PublicKeyAndAddress60Type;
export type GetPublicKeyAndAddressErrorType = BSIMError | TransportError | ApduFlowError;

const computeEthereumAddress = (publicKey: string): string => {
  const normalized = publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey;
  const body = normalized.length === 130 ? normalized.slice(2) : normalized;

  if (body.length !== 128) {
    throw new Error(`Unexpected public key length: ${publicKey.length}`);
  }

  const hash = keccak256(`0x${body}`);
  return getAddress(`0x${hash.slice(-40)}`);
};

const mapRecordToResult = (record: PubkeyRecord): GetPublicKeyAndAddressReturnType => {
  if (record.coinType === 60) {
    return {
      coinType: 60,
      index: record.index,
      key: record.key,
      address: computeEthereumAddress(record.key),
    };
  }

  return {
    coinType: record.coinType,
    index: record.index,
    key: record.key,
  };
};

/**
 * get the public key and address(only support ETH now)
 * @deprecated
 * @returns public key array list {@link GetPublicKeyAndAddressReturnType}
 * @throws {BSIMError} - error
 * @example
 * ```ts
 * const list = await getPublicKeyAndAddress()
 * list.forEach((item) => {
 *  if (item.coinType === 60) {
 *       console.log(item.address, item.index, item.key, item.coinType)
 *   } else {
 *      console.log( item.index, item.key, item.coinType)
 *   }
 })
 * ```
 */
export async function getPublicKeyAndAddress(): Promise<GetPublicKeyAndAddressReturnType[]> {
  const records = await getWallet().exportPubkeys();
  return records.map(mapRecordToResult);
}
