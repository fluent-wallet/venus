import { shortenAddress as _shortenAddress } from '@cfx-kit/dapp-utils/dist/address';
import { memoize } from 'lodash-es';
export * from './base32';

export const shortenAddress = memoize(_shortenAddress);
