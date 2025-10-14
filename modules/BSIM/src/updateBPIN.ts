import { parseApduResponse } from './core/response';
import { buildUpdateBpin, serializeCommand } from './core/params';
import { type BSIMError, ErrorUpdateBPIN } from './errors';
import { getWallet } from './walletInstance';
import { TransportError } from './transports/errors';

export type UpdateBPINErrorType = ErrorUpdateBPIN | BSIMError | TransportError;

/**
 * @deprecated
 * update the BPIN
 * This function just call the user update BPIN UI, it does't know return the BPIN update result,
 * So we can't to know the BPIN update result and it is successful or not
 * @throws {UpdateBPINErrorType}
 * @returns
 */
export async function updateBPIN(): Promise<string> {
  try {
    const result = await getWallet().runSession(async (session) => {
      const response = await session.transmit(serializeCommand(buildUpdateBpin()));
      const parsed = parseApduResponse(response);

      if (parsed.status === 'success') {
        return 'ok';
      }

      if (parsed.status === 'error') {
        throw new ErrorUpdateBPIN(parsed.code, parsed.message ?? 'update BPIN failed');
      }

      throw new ErrorUpdateBPIN(ErrorUpdateBPIN.code, 'BPIN update is still pending');
    });

    return result;
  } catch (error) {
    if (error instanceof ErrorUpdateBPIN || error instanceof TransportError) {
      throw error;
    }

    const message = (error as Error)?.message ?? 'update BPIN failed';
    throw new ErrorUpdateBPIN(ErrorUpdateBPIN.code, message);
  }
}
