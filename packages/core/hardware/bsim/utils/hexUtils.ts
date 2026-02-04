import type { Hex } from 'ox/Hex';
import { HEX_PATTERN } from '../constants';
import { BSIMHardwareError } from '../errors/BSIMHardwareError';

/**
 * Validates and normalizes a hex string
 */
export const parseHex = (value: string): string => {
  const compact = value.replace(/\s+/g, '').replace(/^0x/i, '');
  if (compact.length === 0) {
    throw new BSIMHardwareError('INVALID_HEX_FORMAT', 'Hex value must not be empty.');
  }
  if (compact.length % 2 !== 0) {
    throw new BSIMHardwareError('INVALID_HEX_FORMAT', 'Hex value must contain whole bytes.');
  }
  if (!HEX_PATTERN.test(compact)) {
    throw new BSIMHardwareError('INVALID_HEX_FORMAT', 'Hex value contains invalid characters.');
  }
  return compact.toUpperCase();
};

/**
 * Ensures public key is in uncompressed format (0x04 prefix + 128 hex chars)
 * Accepts:
 * - 128 chars (adds 0x04 prefix)
 * - 130 chars starting with 04 (adds 0x prefix)
 * @throws BSIMHardwareError with code 'INVALID_PUBKEY' if format is unsupported
 */
export const parseUncompressedPublicKey = (key: string): Hex => {
  const normalized = parseHex(key);
  if (normalized.length === 128) return `0x04${normalized}`;
  if (normalized.length === 130 && normalized.startsWith('04')) return `0x${normalized}`;
  throw new BSIMHardwareError('INVALID_PUBKEY', 'Unsupported BSIM public key format.');
};
