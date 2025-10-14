import type { BSIMError, ErrorVerifyBPIN } from './errors';
import type { ApduFlowError } from './core/workflows';
import type { TransportError } from './transports/errors';
import { getWallet } from './walletInstance';

export type VerifyBPINErrorType = ErrorVerifyBPIN | BSIMError | ApduFlowError | TransportError;

/**
 * @deprecated
 */
export async function verifyBPIN(): Promise<void> {
  await getWallet().verifyBpin();
}
