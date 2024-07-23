import { shortenAddress as _shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { convertBase32ToHex as _convertBase32ToHex } from '@cfx-kit/dapp-utils/dist/address';
import { memoize } from 'lodash-es';
export * from './base32';

export { type Base32Address } from '@cfx-kit/dapp-utils/dist/address';
export const convertBase32ToHex = memoize(_convertBase32ToHex);
export const shortenAddress = memoize(_shortenAddress);
export const zeroAddress = '0x0000000000000000000000000000000000000000';
