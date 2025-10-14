import { fromHex } from './core/utils';
import { BSIMError } from './errors';
import { getWallet } from './walletInstance';
import { TransportError } from './transports/errors';

const DEFAULT_ERROR_CODE = 'A000';
const decodeAscii = (hex: string): string => {
  if (!hex) {
    return '';
  }
  const bytes = fromHex(hex);
  const chars: string[] = [];
  for (const byte of bytes) {
    if (byte !== 0) {
      chars.push(String.fromCharCode(byte));
    }
  }
  return chars.join('');
};

/**
 * @deprecated
 * get the BSIM version
 * @returns {Promise<string>}
 * @throws {BSIMError} - error
 * @example
 * ```ts
 *  await getVersion() // x.x.x
 * ```
 */

export async function getVersion(): Promise<string> {
  try {
    const payload = await getWallet().getVersion();
    return decodeAscii(payload);
  } catch (error) {
    if (error instanceof BSIMError || error instanceof TransportError) {
      throw error;
    }
    const message = (error as Error)?.message ?? 'getVersion failed';
    throw new BSIMError(DEFAULT_ERROR_CODE, message);
  }
}
