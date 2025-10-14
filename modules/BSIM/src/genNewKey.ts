import { buildDerivePrivateKey, serializeCommand } from './core/params';
import { parseApduResponse } from './core/response';
import { BSIMError, ErrorCoinTypesNotSupported, ErrorGenerateNewKey } from './errors';
import { TransportError } from './transports/errors';
import { getWallet } from './walletInstance';
import { CoinTypes } from './types';

export type GenNewKeyErrorType = ErrorCoinTypesNotSupported | ErrorGenerateNewKey | BSIMError | TransportError;

const ECDSA_ALGORITHM = 0x01;

const COIN_TYPE_INDEX: Partial<Record<CoinTypes, number>> = {
  [CoinTypes.ETHEREUM]: 60,
  [CoinTypes.CONFLUX]: 503,
};

const resolveCoinTypeIndex = (coin: CoinTypes): number => {
  const index = COIN_TYPE_INDEX[coin];
  if (typeof index !== 'number') {
    throw new ErrorCoinTypesNotSupported(ErrorCoinTypesNotSupported.code, `coin ${coin} is not supported`);
  }
  return index;
};

/**
 * generate new key
 * @deprecated
 * @param coin - {@link CoinTypes}
 * @throws {GenNewKeyErrorType} - error
 * @example
 * ```ts
 * await genNewKey(CoinTypes.ETHEREUM)
 *
 * ```
 */
export async function genNewKey(coin: CoinTypes = CoinTypes.ETHEREUM): Promise<void> {
  try {
    const coinTypeIndex = resolveCoinTypeIndex(coin);

    await getWallet().runSession(async ({ transmit }) => {
      const apdu = serializeCommand(buildDerivePrivateKey(coinTypeIndex, ECDSA_ALGORITHM));
      const response = await transmit(apdu);
      const parsed = parseApduResponse(response);

      if (parsed.status === 'success') {
        return;
      }
      if (parsed.status === 'error') {
        throw new ErrorGenerateNewKey(parsed.code, parsed.message ?? 'generate new key failed');
      }
      throw new ErrorGenerateNewKey(ErrorGenerateNewKey.code, 'key generation still pending');
    });
  } catch (error) {
    if (error instanceof ErrorCoinTypesNotSupported || error instanceof ErrorGenerateNewKey || error instanceof TransportError) {
      throw error;
    }

    const message = (error as Error)?.message ?? 'generate new key failed';
    throw new BSIMError(ErrorGenerateNewKey.code, message);
  }
}
