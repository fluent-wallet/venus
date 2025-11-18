import type { Plugin } from '@core/WalletCore/Plugins';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { Signature as NobleSignature, etc as secp256k1Utils } from '@noble/secp256k1';
import { getAppEnv } from '@utils/getEnv';
import {
  getAddress,
  hashMessage,
  hexlify,
  keccak256,
  Signature,
  SigningKey,
  Transaction,
  type TypedDataDomain,
  TypedDataEncoder,
  type TypedDataField,
  toBeHex,
} from 'ethers';
import {
  BSIMError,
  CARD_ERROR_MESSAGES,
  COIN_TYPE_CONFIG,
  CoinTypes,
  createAsyncQueue,
  createWallet,
  getDefaultSignatureAlgorithm,
  isCardErrorCode,
  isTransportError,
  TransportErrorCode,
  type CardErrorCode,
} from 'react-native-bsim';
import { catchError, defer, firstValueFrom, from, retry, Subject, takeUntil, throwError, timeout, timer } from 'rxjs';
import { BSIM_ERRORS, BSIM_SUPPORT_ACCOUNT_LIMIT, BSIMErrorEndTimeout } from './BSIMSDK';

const ETHEREUM_COIN_TYPE = COIN_TYPE_CONFIG.ETHEREUM.index;

const HEX_PATTERN = /^[0-9A-F]*$/i;

const ensureHex = (value: string): string => {
  const compact = value.replace(/\s+/g, '').replace(/^0x/i, '');
  if (compact.length === 0) {
    throw new BSIMError('A000', 'Hex value must not be empty.');
  }
  if (compact.length % 2 !== 0) {
    throw new BSIMError('A000', 'Hex value must contain whole bytes.');
  }
  if (!HEX_PATTERN.test(compact)) {
    throw new BSIMError('A000', 'Hex value contains invalid characters.');
  }
  return compact.toUpperCase();
};

const addHexPrefix = (value: string): string => (value.startsWith('0x') || value.startsWith('0X') ? value : `0x${value}`);

const ensureUncompressedPublicKey = (publicKey: string): string => {
  const normalized = ensureHex(publicKey);
  if (normalized.length === 128) {
    return addHexPrefix(`04${normalized}`);
  }
  if (normalized.length === 130 && normalized.startsWith('04')) {
    return addHexPrefix(normalized);
  }
  throw new BSIMError('1008', 'Unsupported public key format from BSIM.');
};

const normalizePublicKey = (publicKey: string): string => ensureHex(publicKey);

const toBytes32 = (value: string): Uint8Array => {
  const hex = ensureHex(value).padStart(64, '0');
  return secp256k1Utils.hexToBytes(hex);
};

// Normalize signature S value (EIP-2) and track whether we flipped it.
const canonicalizeSignature = (r: string, s: string): { canonicalS: string; flipped: boolean } => {
  const compact = new Uint8Array(64);
  compact.set(toBytes32(r), 0);
  compact.set(toBytes32(s), 32);

  const original = NobleSignature.fromCompact(compact);
  const normalized = original.normalizeS();
  const flipped = normalized.s !== original.s;

  const canonicalSBytes = normalized.toCompactRawBytes().slice(32);
  return {
    canonicalS: secp256k1Utils.bytesToHex(canonicalSBytes).toUpperCase(),
    flipped,
  };
};

/**
 * After forcing S into the lower half of the curve order, find the recovery bit
 * (v) that still recreates the expected BSIM public key / address.
 */
const resolveRecoveryParam = (digest: string, r: string, s: string, publicKey: string, address: string | undefined): { v: number; s: string } => {
  const normalizedTarget = normalizePublicKey(publicKey);
  const expectedAddress = address?.toLowerCase();

  const { canonicalS, flipped } = canonicalizeSignature(r, s);

  const candidates = [0, 1] as const;

  for (const rawCandidate of candidates) {
    const parity = flipped ? rawCandidate ^ 1 : rawCandidate;
    const normalizedV = parity + 27;
    try {
      const recovered = SigningKey.recoverPublicKey(digest, {
        r: addHexPrefix(r),
        s: addHexPrefix(canonicalS),
        v: parity,
      });
      const normalizedRecovered = normalizePublicKey(recovered);

      // Check if recovered public key matches
      if (normalizedRecovered === normalizedTarget) {
        return { v: normalizedV, s: canonicalS };
      }

      // Fallback: check if recovered address matches
      if (expectedAddress) {
        const recoveredAddress = computeEthereumAddress(normalizedRecovered).toLowerCase();
        if (recoveredAddress === expectedAddress) {
          return { v: normalizedV, s: canonicalS };
        }
      }
    } catch (error) {
      // Expected: this candidate doesn't produce valid recovery
      // Continue to next candidate
    }
  }

  throw new BSIMError('1008', 'Failed to recover BSIM public key from signature.');
};

const computeEthereumAddress = (publicKey: string): string => {
  const normalized = ensureHex(publicKey);
  const body = normalized.length === 130 ? normalized.slice(2) : normalized;
  const hash = keccak256(addHexPrefix(body));
  return getAddress(`0x${hash.slice(-40)}`);
};

const isEthereumPublicKey = (record: BSIMPublicKey): record is EthereumPublicKey =>
  record.coinType === ETHEREUM_COIN_TYPE && typeof record.address === 'string';

type BSIMPublicKey = {
  coinType: number;
  index: number;
  key: string;
  address?: string;
};

type EthereumPublicKey = BSIMPublicKey & { address: string };

type SignResult = {
  code: string;
  message: string;
  r: string;
  s: string;
  v: string;
};

const toHexString = (bytes: ArrayLike<number>) => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;

const sanitizeLogValue = (value: unknown): unknown => {
  if (value instanceof Uint8Array) {
    return toHexString(value).slice(0, 70) + (value.length > 32 ? '…' : '');
  }
  if (value instanceof ArrayBuffer) {
    return sanitizeLogValue(new Uint8Array(value));
  }
  if (value && typeof value === 'object' && 'data' in (value as any) && Array.isArray((value as any).data)) {
    return sanitizeLogValue(new Uint8Array((value as any).data));
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: (value as { code?: unknown }).code };
  }
  return value;
};

const CARD_STATUS_MATCHER = /\b(?:status|code)\s*(?:=|:)?\s*(0x)?([0-9A-F]{4})\b/i;

type ResolvedCardStatus = {
  code: CardErrorCode;
  message: string;
};

const resolveCardStatus = (error: unknown): ResolvedCardStatus | undefined => {
  const detailsCode = (error as { details?: { nativeCode?: string } })?.details?.nativeCode;
  if (detailsCode) {
    const upper = detailsCode.toUpperCase();
    if (isCardErrorCode(upper)) {
      return { code: upper, message: CARD_ERROR_MESSAGES[upper] };
    }
  }

  const message = typeof (error as { message?: string })?.message === 'string' ? (error as { message: string }).message : undefined;
  if (!message) return undefined;

  const match = message.match(CARD_STATUS_MATCHER);
  if (!match) return undefined;

  const candidate = match[2]?.toUpperCase();
  if (!candidate || !isCardErrorCode(candidate)) return undefined;

  return { code: candidate, message: CARD_ERROR_MESSAGES[candidate] };
};

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    BSIM: BSIMPluginClass;
  }
}

export class BSIMPluginClass implements Plugin {
  name = 'BSIM' as const;

  chainLimitCount = 25 as const;

  private queue = createAsyncQueue();

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    return this.queue.enqueue(task);
  }

  private async handleWalletCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.enqueue(operation);
    } catch (error) {
      if (isTransportError(error)) {
        const status = resolveCardStatus(error);
        if (status) {
          const friendly = BSIM_ERRORS[status.code] ?? status.message ?? `BSIM error. Error code: ${status.code}`;
          throw new BSIMError(status.code, friendly);
        }

        const fallbackCode = error.code ?? TransportErrorCode.TRANSMIT_FAILED;
        const fallbackMessage = BSIM_ERRORS[fallbackCode] ?? error.message ?? 'BSIM error, unknown error.';
        throw new BSIMError(fallbackCode, fallbackMessage);
      }

      const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code.toUpperCase() : undefined;
      if (code) {
        const message = BSIM_ERRORS[code] ?? (error as Error).message ?? 'BSIM error, unknown error.';
        throw new BSIMError(code, message);
      }

      throw error;
    }
  }
  private wallet = createWallet({
    logger: (event, context) => {
      if (getAppEnv() !== 'dev') return;

      const sanitized = context ? Object.fromEntries(Object.entries(context).map(([key, v]) => [key, sanitizeLogValue(v)])) : undefined;

      if (sanitized) {
        console.log(event, sanitized);
      } else {
        console.log(event);
      }
    },
  });

  public formatBSIMPubkey = (key: string) => {
    if (key.length === 128) {
      return key;
    }
    if (key.length === 130 && key.slice(0, 2) === '00') {
      return key.slice(2);
    }
    return key;
  };

  private async loadPubkeys(): Promise<BSIMPublicKey[]> {
    const records = await this.handleWalletCall(() => this.wallet.exportPubkeys());
    return records.map((record) => {
      const base: BSIMPublicKey = {
        coinType: record.coinType,
        index: record.index,
        key: record.key,
      };
      if (record.coinType === ETHEREUM_COIN_TYPE) {
        try {
          return { ...base, address: computeEthereumAddress(record.key) };
        } catch {
          return base;
        }
      }
      return base;
    });
  }

  public getBSIMPublicKeys = async () => this.loadPubkeys();

  public getBSIMList = async () => {
    const list = await this.getBSIMPublicKeys();
    return list
      .filter((item) => item.index > 0)
      .filter(isEthereumPublicKey)
      .map((item) => ({ hexAddress: item.address, index: item.index, coinType: item.coinType }))
      .sort((itemA, itemB) => itemA.index - itemB.index)
      .map((item, index) => ({ ...item, index }));
  };

  public createNewBSIMAccount = async () => {
    try {
      await this.handleWalletCall(() => this.wallet.deriveKey({ coinType: ETHEREUM_COIN_TYPE, algorithm: getDefaultSignatureAlgorithm(CoinTypes.ETHEREUM) }));

      const list = await this.getBSIMList();

      const BSIMKey = list.at(-1);
      if (!BSIMKey) throw new Error('create new BSIM account failed');

      return { hexAddress: BSIMKey.hexAddress, index: BSIMKey.index };
    } catch (error: any) {
      if (error instanceof BSIMError) {
        const errorMsg = BSIM_ERRORS[error.code.toUpperCase()] || error.message;
        throw new Error(errorMsg);
      }
      throw error;
    }
  };

  public createBSIMAccountToIndex = async (targetIndex: number) => {
    const list = await this.getBSIMList();
    const maxIndex = list.at(-1)?.index ?? -1;
    if (maxIndex >= targetIndex || maxIndex >= BSIM_SUPPORT_ACCOUNT_LIMIT) return;

    let index = maxIndex;
    do {
      index = (await this.createNewBSIMAccount()).index;
    } while (index < targetIndex);
  };

  public connectBSIM = async () => {
    const list = await this.getBSIMList();
    if (list?.length > 0) {
      return list.slice(0, 1);
    } else {
      const created = await this.createNewBSIMAccount();
      return [created];
    }
  };

  public verifyBPIN = async () => this.handleWalletCall(() => this.wallet.verifyBpin());

  public getBSIMVersion = async () => this.handleWalletCall(() => this.wallet.getVersion());
  
  public getBSIMICCID = async () => this.handleWalletCall(() => this.wallet.getIccid());

  public updateBPIN = async () => this.handleWalletCall(() => this.wallet.updateBpin());

  public BSIMSignMessage = async (message: string, coinTypeIndex: number, index: number, pubkey?: BSIMPublicKey): Promise<SignResult> => {
    const record = pubkey ?? (await this.loadPubkeys()).find((item) => item.coinType === coinTypeIndex && item.index === index);

    if (!record) {
      throw new Error("Can't get current pubkey from BSIM card");
    }

    const normalizedHash = ensureHex(message);
    const digest = addHexPrefix(normalizedHash);
    const { r, s } = await this.handleWalletCall(() => this.wallet.signMessage({ hash: digest, coinType: record.coinType, index: record.index }));
    const uncompressedKey = ensureUncompressedPublicKey(record.key);

    const { v, s: canonicalS } = resolveRecoveryParam(digest, r, s, uncompressedKey, record.address);

    return {
      code: '9000',
      message: '',
      r: hexlify(addHexPrefix(r)),
      s: hexlify(addHexPrefix(canonicalS)),
      v: toBeHex(v),
    };
  };

  private BSIMSign = async (hash: string, fromAddress: string) => {
    try {
      await this.verifyBPIN();
    } catch (error: any) {
      if (error?.code && error.code === 'A000') {
        console.log("get error code A000, it's ok");
      } else {
        throw new BSIMError(error.code, error.message);
      }
    }

    let errorMsg = '';
    let errorCode = '';

    const pubkeyList = await this.getBSIMPublicKeys();
    const currentPubkey = pubkeyList.find((item) => isEthereumPublicKey(item) && item.address === fromAddress);

    if (!currentPubkey) {
      throw new Error("Can't get current pubkey from BSIM card");
    }

    const cancelSignal = new Subject<void>();
    let cancel!: () => void;

    const cancelPromise = new Promise<never>((_, reject) => {
      cancel = () => {
        cancelSignal.next();
        cancelSignal.complete();
        reject(new BSIMError('cancel', BSIM_ERRORS.cancel));
      };
    });

    const polling = firstValueFrom(
      defer(() => from(this.BSIMSignMessage(hash, currentPubkey.coinType, currentPubkey.index, currentPubkey))).pipe(
        catchError((err: { code?: string; message: string }) => {
          errorMsg = err.message;
          errorCode = err.code ?? '';
          return throwError(() => err);
        }),
        retry({
          delay: (err: { code?: string }) => {
            if (err.code?.toUpperCase() === 'CANCEL') throw err;
            return timer(1000);
          },
        }),
        timeout({
          each: 30 * 1000,
          with: () => {
            return throwError(() => new BSIMErrorEndTimeout(errorCode, errorMsg));
          },
        }),
        takeUntil(cancelSignal),
      ),
    );

    const resPromise = Promise.race([polling, cancelPromise] as const)
      .then((res) => res as SignResult)
      .catch((err) => {
        if (String(err).includes('no elements in sequence')) {
          throw new BSIMError('cancel', BSIM_ERRORS.cancel);
        } else {
          throw err;
        }
      });

    return [resPromise, cancel] as const;
  };

  public signTransaction = async (fromAddress: string, tx: ITxEvm) => {
    const transaction = new Transaction();
    for (const key in tx) {
      transaction[key as 'to'] = tx[key as 'to'];
    }

    const hash = transaction.unsignedHash;
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);

    return [
      resPromise.then((res) => {
        transaction.signature = Signature.from({ r: res.r, s: res.s, v: res.v });
        return transaction.serialized;
      }),
      cancel,
    ] as const;
  };

  public signMessage = async (message: string, fromAddress: string) => {
    const hash = hashMessage(message);
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);
    return [
      resPromise.then((res) => {
        return Signature.from({ r: res.r, s: res.s, v: res.v });
      }),
      cancel,
    ] as const;
  };

  public signTypedData = async (domain: TypedDataDomain, _types: Record<string, Array<TypedDataField>>, value: Record<string, any>, fromAddress: string) => {
    const { EIP712Domain, ...types } = _types;
    const hash = TypedDataEncoder.hash(domain, types, value);
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);
    return [
      resPromise.then((res) => {
        return Signature.from({ r: res.r, s: res.s, v: res.v });
      }),
      cancel,
    ] as const;
  };
}

export default new BSIMPluginClass();
