import { isPendingStatus, isProactiveStatus, isSuccessStatus, resolveStatusMessage } from './errors';
import type { HexString } from './types';
import { normalizeHex } from './utils';

export type ParsedApduResponse =
  | { status: 'success'; payload: HexString }
  | { status: 'pending'; payload: HexString }
  | { status: 'error'; code: string; message?: string };

/**
 * split raw APDU response into payload + status word
 */
export const parseApduResponse = (rawResponse: HexString): ParsedApduResponse => {
  const normalized = normalizeHex(rawResponse);

  if (normalized.length < 4) {
    return { status: 'error', code: 'A000', message: 'Invalid APDU response length' };
  }

  const statusWord = normalized.slice(-4); // SW1SW2 are always the last two bytes.
  const payload = normalized.slice(0, -4); // Remainder is the response payload.

  if (isSuccessStatus(statusWord)) {
    return { status: 'success', payload };
  }

  if (isProactiveStatus(statusWord)) {
    // Mirror current native demo behaviour: treat 0x91xx proactive responses as a completed operation.
    return { status: 'success', payload };
  }

  if (isPendingStatus(statusWord)) {
    return { status: 'pending', payload };
  }

  return {
    status: 'error',
    code: statusWord,
    message: resolveStatusMessage(statusWord),
  };
};
