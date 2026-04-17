import type { Hex } from '@core/types';

export const FIXED_NATIVE_TRANSFER_GAS_LIMIT = '0x5208' as Hex;
export const FIXED_NATIVE_TRANSFER_STORAGE_LIMIT = '0x0' as Hex;

// Conflux Core storage collateral is 1 CFX per 1024 bytes.

// helios/packages/estimate-tx/cfx.js
//   const storageFeeDrip = bn16(storageLimit)
// .mul(bn16('0xde0b6b3a7640000' /* 1e18 */))
// .divn(1024)
export const DRIP_PER_STORAGE_BYTE = 10n ** 18n / 1024n;

export function getStorageCollateralDrip(storageLimit: string): bigint {
  return BigInt(storageLimit) * DRIP_PER_STORAGE_BYTE;
}
