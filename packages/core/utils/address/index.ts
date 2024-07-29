import { shortenAddress as _shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { convertBase32ToHex as _convertBase32ToHex } from '@cfx-kit/dapp-utils/dist/address';
import { convertHexToBase32 as _convertHexToBase32WithoutReplace } from '@cfx-kit/dapp-utils/dist/address';
import { memoize } from 'lodash-es';
export * from './base32';
import { encode } from './base32';
import { toAccountAddress } from '../account';

const _convertHexToBase32 = (hexAddress: string, netId: number) => encode(toAccountAddress(hexAddress), netId);

export { type Base32Address } from '@cfx-kit/dapp-utils/dist/address';
export const convertBase32ToHex = memoize(_convertBase32ToHex);
export const convertHexToBase32 = memoize(_convertHexToBase32);
export const convertHexToBase32WithoutReplace = memoize(_convertHexToBase32WithoutReplace);
export const shortenAddress = memoize(_shortenAddress);
export const zeroAddress = '0x0000000000000000000000000000000000000000';
