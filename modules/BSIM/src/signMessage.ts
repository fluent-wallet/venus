import { SigningKey, hexlify, toBeHex } from 'ethers';
import { normalizeHex } from './core/utils';
import type { ApduFlowError } from './core/workflows';
import { type BSIMError, ErrorSignCoinTypeNotFind, ErrorSignGetPublicKey, ErrorSignMessage } from './errors';
import type { TransportError } from './transports/errors';
import { getWallet } from './walletInstance';

export type SignMessageErrorType = ErrorSignMessage | ErrorSignGetPublicKey | BSIMError | TransportError | ApduFlowError;

export type SignMessageReturnType = {
  code: string;
  message: string;
  r: string;
  s: string;
  v: string;
};

export type SignMessageParametersType = {
  messageHash: string;
  /**
   * coin type number eg: 60  503
   */
  coinType: number;
  /**
   * public key index
   */
  coinTypeIndex: number;
};

const ensureUncompressedPublicKey = (hexKey: string): string => {
  const normalized = normalizeHex(hexKey);
  if (normalized.length === 128) {
    return `04${normalized}`;
  }
  if (normalized.length === 130 && normalized.startsWith('04')) {
    return normalized;
  }
  throw new ErrorSignMessage(ErrorSignMessage.code, `Unsupported public key format (len=${normalized.length})`);
};

const resolveRecoveryParam = (digest: string, r: string, s: string, targetKey: string): number => {
  const candidates = [27, 28, 0, 1];
  const normalizedTarget = normalizeHex(targetKey);

  for (const candidate of candidates) {
    try {
      const recovered = SigningKey.recoverPublicKey(digest, { r: `0x${r}`, s: `0x${s}`, v: candidate });
      const normalizedRecovered = normalizeHex(recovered.replace(/^0x/i, ''));
      if (normalizedRecovered === normalizedTarget) {
        return candidate >= 27 ? candidate : candidate + 27;
      }
    } catch {
      /* ignore invalid candidates */
    }
  }

  throw new ErrorSignMessage(ErrorSignMessage.code, 'Failed to recover matching public key from signature');
};

/**
 * @deprecated
 * sign message hash use BSIM
 * call this function after {@link verifyBPIN} function
 * might need to be called multiple times after call {@link verifyBPIN}
 * @throws {SignMessageErrorType}
 * @param messageHash need sign message hash
 * @param coinTypeIndex
 * @returns {Promise<string>} - sign result
 */
export async function signMessage({ messageHash, coinType, coinTypeIndex }: SignMessageParametersType): Promise<SignMessageReturnType> {
  try {
    const wallet = getWallet();
    const records = await wallet.exportPubkeys();
    const sameCoinRecords = records.filter((item) => item.coinType === coinType);
    if (sameCoinRecords.length === 0) {
      throw new ErrorSignCoinTypeNotFind(ErrorSignCoinTypeNotFind.code, 'error coin type index');
    }

    const record = sameCoinRecords.find((item) => item.index === coinTypeIndex);
    if (!record) {
      throw new ErrorSignGetPublicKey(ErrorSignGetPublicKey.code, 'No public key index match');
    }

    const normalizedHash = normalizeHex(messageHash);
    const digest = `0x${normalizedHash}`;
    const { r, s } = await wallet.signMessage({ hash: normalizedHash, coinType, index: coinTypeIndex });

    const publicKey = ensureUncompressedPublicKey(record.key);
    const v = resolveRecoveryParam(digest, r, s, publicKey);

    return {
      code: '9000',
      message: '',
      r: hexlify(`0x${r}`),
      s: hexlify(`0x${s}`),
      v: toBeHex(v),
    };
  } catch (error) {
    if ((error as { code?: unknown })?.code) {
      throw error;
    }
    const message = (error as Error)?.message ?? 'sign message failed';
    throw new ErrorSignMessage(ErrorSignMessage.code, message);
  }
}
