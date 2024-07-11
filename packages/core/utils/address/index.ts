import { shortenAddress as _shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { convertCfxToHex as _convertCfxToHex } from '@cfx-kit/dapp-utils/dist/address';
import { memoize } from 'lodash-es';
export * from './base32';

export const convertCfxToHex = memoize(_convertCfxToHex);
export const shortenAddress = memoize(_shortenAddress);
export const zeroAddress = '0x0000000000000000000000000000000000000000';
