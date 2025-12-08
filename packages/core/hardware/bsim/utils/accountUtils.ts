import type { HardwareAccount } from '@core/types';
import type { Address } from '@core/types/chain';
import { NetworkType } from '@core/utils/consts';
import { computeAddress } from 'ethers';
import type { PubkeyRecord } from 'react-native-bsim';
import { DEFAULT_DERIVATION_PREFIX, EVM_COIN_TYPE } from '../constants';
import { BSIMHardwareError } from '../errors/BSIMHardwareError';
import { parseUncompressedPublicKey } from './hexUtils';

/**
 * Builds BIP-44 derivation path for given account index
 * @param index - Account index (non-negative integer)
 * @param prefix - Optional derivation path prefix, defaults to m/44'/60'/0'/0
 * @returns Full derivation path, e.g., "m/44'/60'/0'/0/5"
 */
export const buildDerivationPath = (index: number, prefix: string = DEFAULT_DERIVATION_PREFIX): string => `${prefix}/${index}`;

/**
 * Removes whitespace from derivation path for safe comparison
 * @param path - Derivation path that may contain whitespace
 * @returns Path with all whitespace removed
 */
export const trimDerivationPath = (path: string): string => path.replace(/\s+/g, '');

/**
 * Filters and normalizes BSIM public key records into sequential indexes
 * - Filters to EVM coin type only
 * - Filters out index 0 (reserved by BSIM)
 * - Sorts by hardware index
 * - Maps to normalized sequential indexes (0, 1, 2, ...)
 * @param records - Raw public key records from BSIM card
 * @returns Array of {record, normalizedIndex} pairs
 */
export const filterAndSortBSIMRecords = (records: PubkeyRecord[]) =>
  records
    .filter((record) => record.coinType === EVM_COIN_TYPE && record.index > 0)
    .sort((a, b) => a.index - b.index)
    .map((record, normalizedIndex) => ({ record, normalizedIndex }));

/**
 * Extracts account index from end of derivation path
 * @param path - BIP-44 derivation path
 * @returns Account index as integer
 * @throws BSIMHardwareError with code 'INVALID_PATH' if path format is invalid
 * @example
 * parseDerivationPathIndex("m/44'/60'/0'/0/5") // returns 5
 */
export const parseDerivationPathIndex = (path: string): number => {
  const trimmed = path.trim();
  const match = /\/(\d+)$/.exec(trimmed);
  if (!match) throw new BSIMHardwareError('INVALID_PATH', `Unsupported derivation path: ${path}`);
  return Number.parseInt(match[1], 10);
};

/**
 * Converts BSIM PubkeyRecord to HardwareAccount interface
 * @param record - Raw public key record from BSIM card
 * @param normalizedIndex - Sequential UI index (0, 1, 2...)
 * @returns HardwareAccount with derivation path using hardware index
 */
export const convertBSIMRecordToAccount = (record: PubkeyRecord, normalizedIndex: number): HardwareAccount => {
  const publicKey = parseUncompressedPublicKey(record.key);
  const address: Address = computeAddress(publicKey);
  return {
    index: normalizedIndex,
    chainType: NetworkType.Ethereum,
    address,
    derivationPath: buildDerivationPath(record.index),
    publicKey,
  };
};
