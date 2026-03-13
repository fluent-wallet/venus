import type {
  EvmUnsignedTransactionPayload,
  HardwareAccount,
  HardwareConnectOptions,
  HardwareOperationOptions,
  HardwareSignResult,
  HardwareWalletCapabilities,
  IBSIMWallet,
  SigningContext,
  SigningPayload,
} from '@core/types';
import type { Address, ChainType, Hash } from '@core/types/chain';
import { NetworkType } from '@core/utils/consts';
import { getBytes, hashMessage, keccak256, Signature, Transaction, TypedDataEncoder } from 'ethers';
import type { Hex } from 'ox/Hex';
import { Platform } from 'react-native';
import {
  CoinTypes,
  createAsyncQueue,
  createWallet,
  DEFAULT_SIGNATURE_ALGORITHM,
  type DeriveKeyParams,
  getDefaultSignatureAlgorithm,
  type PubkeyRecord,
  type Wallet,
  type WalletOptions,
} from 'react-native-bsim';
import { BSIM_ACCOUNT_LIMIT, BSIM_ERROR_CANCEL, EVM_CHAIN_ERROR, EVM_COIN_TYPE } from './constants';
import { assertAbortable, BSIMHardwareError, createAbortError, normalizeError as normalizeErrorUtil } from './errors';
import type { BSIMAdapterOptions, RetryOptions } from './types';
import { convertBSIMRecordToAccount, filterAndSortBSIMRecords, parseDerivationPathIndex, parseHex, resolveRecoveryParam, trimDerivationPath } from './utils';

/**
 * Returns default retry timeout based on platform
 * iOS Bluetooth connection is slower and needs more time
 */
const getDefaultRetryTimeout = (): number => {
  return Platform.OS === 'ios' ? 60000 : 30000;
};

/**
 * BSIM Hardware Wallet Adapter
 * Implements IHardwareWallet and IBSIMWallet interfaces for BSIM card integration
 */
export class BSIMHardwareWallet implements IBSIMWallet {
  readonly id: string;
  readonly type = 'bsim' as const;

  private wallet: Wallet | null = null;
  private connected = false;
  private capabilities: HardwareWalletCapabilities = { type: 'bsim' };
  private readonly factory: (options: WalletOptions) => Wallet;
  private readonly baseOptions: Pick<WalletOptions, 'idleTimeoutMs' | 'logger'>;
  private readonly queue = createAsyncQueue();

  private lastTransport: 'apdu' | 'ble' | undefined;
  private lastDeviceIdentifier: string | undefined;

  constructor(options: BSIMAdapterOptions = {}) {
    this.id = options.id ?? 'bsim-adapter';
    this.factory = options.walletFactory ?? createWallet;
    this.baseOptions = options.walletOptions ?? {};
  }

  async connect(options?: HardwareConnectOptions): Promise<void> {
    const transport = this.resolveConnectTransport(options);

    const deviceIdentifier = this.normalizeDeviceIdentifier(options);

    const normalizedOptions: HardwareConnectOptions = {
      ...options,
      transport,
      deviceIdentifier,
    };

    const canReuse = this.connected && this.wallet && this.lastTransport === transport && this.lastDeviceIdentifier === deviceIdentifier;

    if (canReuse) {
      try {
        await this.runWithAbort(normalizedOptions.signal, async () => this.ensureHardwareReady(normalizedOptions.signal));
        return;
      } catch {
        this.resetConnection();
      }
    } else if (this.connected || this.wallet) {
      this.resetConnection();
    }

    this.wallet = this.factory({ ...this.baseOptions, ...this.buildTransportOptions(normalizedOptions) });
    this.lastTransport = transport;
    this.lastDeviceIdentifier = deviceIdentifier;

    try {
      await this.runWithAbort(normalizedOptions.signal, async () => {
        const wallet = this.wallet;
        if (!wallet) {
          throw new BSIMHardwareError('NOT_CONNECTED', 'BSIM wallet has not been connected.');
        }
        await wallet.getVersion();
        this.connected = true;
      });
    } catch (error) {
      this.handleOperationError(error);
    }
  }

  async disconnect(): Promise<void> {
    this.resetConnection();
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  getCapabilities(): HardwareWalletCapabilities {
    return this.capabilities;
  }

  async listAccounts(chainType: ChainType): Promise<HardwareAccount[]> {
    this.guardChain(chainType);
    await this.ensureHardwareReady();
    return this.listAccountsUnsafe();
  }

  /**
   * Lists accounts without hardware readiness check.
   * INTERNAL USE ONLY: Caller must ensure hardware is ready before calling.
   */
  private async listAccountsUnsafe(signal?: AbortSignal): Promise<HardwareAccount[]> {
    const records = await this.runSdkCall((wallet) => wallet.exportPubkeys(), signal);
    return filterAndSortBSIMRecords(records).map(({ record, normalizedIndex }) => convertBSIMRecordToAccount(record, normalizedIndex));
  }

  async deriveAccount(targetIndex: number, chainType: ChainType): Promise<HardwareAccount> {
    this.guardChain(chainType);
    if (targetIndex >= BSIM_ACCOUNT_LIMIT) {
      throw new BSIMHardwareError('ACCOUNT_LIMIT', `BSIM only supports ${BSIM_ACCOUNT_LIMIT} accounts.`);
    }
    await this.ensureHardwareReady();
    const accounts = await this.listAccountsUnsafe();
    const existing = accounts.find((account) => account.index === targetIndex);
    if (existing) {
      return existing;
    }

    // Sequentially derive additional accounts until we reach target index
    let currentMax = Math.max(-1, ...accounts.map((account) => account.index));
    while (currentMax < targetIndex) {
      await this.runSdkCall((wallet) => wallet.deriveKey(this.buildDeriveParams()));
      currentMax += 1;
    }

    const updatedAccounts = await this.listAccountsUnsafe();
    const targetAccount = updatedAccounts.find((account) => account.index === targetIndex);
    if (!targetAccount) {
      throw new BSIMHardwareError('ACCOUNT_NOT_FOUND', `Unable to locate BSIM account at index ${targetIndex}.`);
    }
    return targetAccount;
  }

  async deriveAddress(path: string, chainType: ChainType): Promise<Address> {
    const account = await this.resolveAccountForPath(path, chainType);
    return account.address;
  }

  async sign(context: SigningContext): Promise<HardwareSignResult> {
    this.guardChain(context.chainType);
    await this.ensureHardwareReady(context.signal);
    await this.verifyBpinGracefully(context.signal);
    const account = await this.resolveAccountForPath(context.derivationPath, context.chainType, context.signal);
    const payload = context.payload;
    const signal = context.signal;

    switch (payload.payloadKind) {
      case 'transaction':
        return this.signTransactionPayload(payload.unsignedTx, account, context, signal);
      case 'message':
        if (payload.messageKind === 'personal') {
          return this.signPersonalMessage(payload.message, account, signal);
        }
        return this.signTypedData(payload, account, signal);
      case 'raw':
        return this.signRawMessage(payload.data, account, signal);
      default:
        throw new BSIMHardwareError('UNSUPPORTED_PAYLOAD', 'Unsupported signing payload.');
    }
  }

  private async signTransactionPayload(
    unsignedTx: EvmUnsignedTransactionPayload,
    account: HardwareAccount,
    context: SigningContext,
    signal?: AbortSignal,
  ): Promise<HardwareSignResult> {
    const tx = Transaction.from({ ...unsignedTx, from: undefined });
    const digest = tx.unsignedHash;
    const signature = await this.requestSignature(digest, account, signal);

    tx.signature = Signature.from(signature);
    const rawTransaction = tx.serialized as Hex;
    const hash = keccak256(rawTransaction) as Hash;

    return {
      resultType: 'rawTransaction',
      chainType: context.chainType,
      rawTransaction,
      hash,
    };
  }

  private async signPersonalMessage(message: string, account: HardwareAccount, signal?: AbortSignal): Promise<HardwareSignResult> {
    const isHexBytes = message.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(message);
    if (!isHexBytes) {
      throw new BSIMHardwareError('INVALID_HEX_FORMAT', 'Personal sign message must be a 0x-prefixed hex string.');
    }

    const digest = hashMessage(getBytes(message)) as Hex;
    const signature = await this.requestSignature(digest, account, signal);

    return {
      resultType: 'signature',
      chainType: NetworkType.Ethereum,
      r: signature.r,
      s: signature.s,
      v: signature.v,
      digest,
    };
  }

  private async signTypedData(
    payload: Extract<SigningPayload, { payloadKind: 'message'; messageKind: 'typedData' }>,
    account: HardwareAccount,
    signal?: AbortSignal,
  ): Promise<HardwareSignResult> {
    const { EIP712Domain: _ignored, ...types } = payload.types;
    const digest = TypedDataEncoder.hash(payload.domain, types, payload.message);
    const signature = await this.requestSignature(digest, account, signal);
    const serialized = Signature.from(signature).serialized;
    return {
      resultType: 'typedSignature',
      chainType: NetworkType.Ethereum,
      signature: serialized,
    };
  }

  private async signRawMessage(data: Hex, account: HardwareAccount, signal?: AbortSignal): Promise<HardwareSignResult> {
    const digest = this.normalizeDigest(data);
    const signature = await this.requestSignature(digest, account, signal);
    return {
      resultType: 'signature',
      chainType: NetworkType.Ethereum,
      r: signature.r,
      s: signature.s,
      v: signature.v,
      digest,
    };
  }

  private async resolveAccountForPath(path: string, chainType: ChainType, signal?: AbortSignal): Promise<HardwareAccount> {
    this.guardChain(chainType);
    const accounts = await this.listAccountsUnsafe(signal);
    const normalizedTargetPath = trimDerivationPath(path);
    const match = accounts.find((item) => (item.derivationPath ? trimDerivationPath(item.derivationPath) === normalizedTargetPath : false));
    if (!match) {
      throw new BSIMHardwareError('ACCOUNT_NOT_FOUND', `No BSIM account at derivation path ${path}`);
    }
    if (!match.publicKey) {
      throw new BSIMHardwareError('MISSING_PUBKEY', 'BSIM account is missing public key information.');
    }
    return match;
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.queue.enqueue(operation);
  }

  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      assertAbortable(signal);

      const timeout = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timeout);
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        reject(createAbortError());
      };

      if (signal) {
        signal.addEventListener('abort', onAbort);
      }
    });
  }

  /**
   * Retries an operation with a fixed delay until success or timeout.
   * Each retry is separated by delayMs. If the operation is aborted via signal,
   * throws immediately without further retries.
   *
   * Default timeout: Android 30s, iOS 60s (Bluetooth connection is slower on iOS)
   */
  private async retryWithTimeout<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxAttempts = Number.POSITIVE_INFINITY, delayMs = 1000, timeoutMs = getDefaultRetryTimeout(), signal } = options;

    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    let attempt = 0;

    while (Date.now() < deadline && attempt < maxAttempts) {
      assertAbortable(signal);
      attempt++;

      try {
        return await operation();
      } catch (error) {
        if (error instanceof BSIMHardwareError && error.code === BSIM_ERROR_CANCEL) {
          throw error;
        }
        lastError = error;

        // If there's time left and haven't reached max attempts, delay before retry
        if (Date.now() + delayMs < deadline && attempt < maxAttempts) {
          await this.delay(delayMs, signal);
        }
      }
    }

    // Timeout reached, throw the last error with timeout context
    const code = typeof (lastError as any)?.code === 'string' ? (lastError as any).code : 'TIMEOUT';
    const originalMessage = (lastError as Error)?.message ?? 'Unknown error';
    throw new BSIMHardwareError(code, `Operation timed out after ${timeoutMs}ms: ${originalMessage}`);
  }

  /**
   * Requests a signature from the BSIM card with automatic retry on failure.
   * Retries every 1 second until timeout (Android: 30s, iOS: 60s).
   */
  private async requestSignature(digest: string, account: HardwareAccount, signal?: AbortSignal): Promise<{ r: Hex; s: Hex; v: number }> {
    if (!account.publicKey) {
      throw new BSIMHardwareError('MISSING_PUBKEY', 'BSIM account is missing public key information.');
    }
    const normalizedHash = this.normalizeDigest(digest);

    const response = await this.retryWithTimeout(
      () =>
        this.runSdkCall(
          (wallet) =>
            wallet.signMessage({
              hash: normalizedHash,
              coinType: EVM_COIN_TYPE,
              index: this.resolveHardwareIndex(account),
            }),
          signal,
        ),
      {
        delayMs: 1000,
        signal,
      },
    );

    const { v, s } = resolveRecoveryParam(normalizedHash, response.r, response.s, account.publicKey, account.address);
    return {
      r: `0x${parseHex(response.r)}` as Hex,
      s: `0x${s}` as Hex,
      v,
    };
  }

  private normalizeDigest(digest: string): Hex {
    const normalized = digest.startsWith('0x') ? digest : `0x${digest}`;
    return normalized as Hex;
  }

  async verifyBpin(options?: HardwareOperationOptions): Promise<void> {
    await this.ensureHardwareReady(options?.signal);
    await this.runSdkCall((wallet) => wallet.verifyBpin(), options?.signal);
  }

  async updateBpin(options?: HardwareOperationOptions): Promise<'ok'> {
    await this.ensureHardwareReady(options?.signal);
    return this.runSdkCall((wallet) => wallet.updateBpin(), options?.signal);
  }

  async getIccid(options?: HardwareOperationOptions): Promise<string> {
    await this.ensureHardwareReady(options?.signal);
    return this.runSdkCall((wallet) => wallet.getIccid(), options?.signal);
  }

  async getVersion(options?: HardwareOperationOptions): Promise<string> {
    await this.ensureHardwareReady(options?.signal);
    return this.runSdkCall((wallet) => wallet.getVersion(), options?.signal);
  }

  /**
   * Backs up the seed from BSIM card with automatic retry on failure.
   * Retries every 1 second until timeout (Android: 30s, iOS: 60s).
   */
  async backupSeed(params: Parameters<Wallet['backupSeed']>[0], options?: HardwareOperationOptions): Promise<string> {
    await this.verifyBpinGracefully(options?.signal);
    return this.retryWithTimeout(() => this.runSdkCall((wallet) => wallet.backupSeed(params), options?.signal), {
      delayMs: 1000,
      signal: options?.signal,
    });
  }

  async restoreSeed(params: Parameters<Wallet['restoreSeed']>[0], options?: HardwareOperationOptions): Promise<'ok'> {
    await this.verifyBpinGracefully(options?.signal);
    return this.runSdkCall((wallet) => wallet.restoreSeed(params), options?.signal);
  }

  async exportPubkeys(options?: HardwareOperationOptions): Promise<PubkeyRecord[]> {
    await this.ensureHardwareReady(options?.signal);
    return this.runSdkCall((wallet) => wallet.exportPubkeys(), options?.signal);
  }

  async deriveKey(params: DeriveKeyParams, options?: HardwareOperationOptions): Promise<void> {
    await this.ensureHardwareReady(options?.signal);
    await this.runSdkCall((wallet) => wallet.deriveKey(params), options?.signal);
  }

  private guardChain(chainType: ChainType): asserts chainType is NetworkType.Ethereum {
    if (chainType !== NetworkType.Ethereum) {
      throw new BSIMHardwareError('CHAIN_UNSUPPORTED', EVM_CHAIN_ERROR, { chainType });
    }
  }

  private buildDeriveParams(): DeriveKeyParams {
    return {
      coinType: EVM_COIN_TYPE,
      algorithm: getDefaultSignatureAlgorithm(CoinTypes.ETHEREUM) ?? DEFAULT_SIGNATURE_ALGORITHM,
    };
  }

  private requireWallet(): Wallet {
    if (!this.connected || !this.wallet) {
      throw new BSIMHardwareError('NOT_CONNECTED', 'BSIM wallet has not been connected.');
    }
    return this.wallet;
  }

  private async verifyBpinGracefully(signal?: AbortSignal): Promise<void> {
    try {
      await this.verifyBpin({ signal });
    } catch (error) {
      if (!(error instanceof BSIMHardwareError) || error.code !== 'A000') {
        throw error;
      }
    }
  }

  private async ensureHardwareReady(signal?: AbortSignal): Promise<void> {
    this.requireWallet();
    assertAbortable(signal);
    try {
      await this.runExclusive(() => this.wallet!.getVersion());
    } catch (error) {
      this.handleOperationError(error);
    }
  }
  private resolveConnectTransport(options?: HardwareConnectOptions): 'apdu' | 'ble' {
    if (options?.transport === 'apdu' || options?.transport === 'ble') {
      return options.transport;
    }
    return Platform.OS === 'ios' ? 'ble' : 'apdu';
  }

  private normalizeDeviceIdentifier(options?: HardwareConnectOptions): string | undefined {
    const value = options?.deviceIdentifier?.trim();
    return value ? value : undefined;
  }

  private buildTransportOptions(options?: HardwareConnectOptions): WalletOptions {
    const transport = this.resolveConnectTransport(options);
    const deviceIdentifier = this.normalizeDeviceIdentifier(options);

    if (transport === 'ble') {
      return { transports: [{ kind: 'ble', options: { deviceId: deviceIdentifier } }] };
    }

    return { transports: [{ kind: 'apdu' }] };
  }

  /**
   * Runs a task with AbortSignal support for cancellation.
   */
  private async runWithAbort<T>(signal: AbortSignal | undefined, task: () => Promise<T>): Promise<T> {
    assertAbortable(signal);
    if (!signal) return task();
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        signal.removeEventListener('abort', onAbort);
        reject(createAbortError());
      };
      signal.addEventListener('abort', onAbort);
      task()
        .then((result) => {
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        })
        .catch((error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        });
    });
  }

  private async runSdkCall<T>(operation: (wallet: Wallet) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const wallet = this.requireWallet();
    return this.runWithAbort(signal, async () => {
      try {
        return await this.runExclusive(() => operation(wallet));
      } catch (error) {
        this.handleOperationError(error);
      }
    });
  }

  private resolveHardwareIndex(account: HardwareAccount): number {
    const path = account.derivationPath;
    if (!path) {
      throw new BSIMHardwareError('MISSING_PATH', 'BSIM account derivation path is missing.');
    }
    return parseDerivationPathIndex(path);
  }

  private normalizeError(error: unknown): BSIMHardwareError {
    return normalizeErrorUtil(error);
  }

  private handleOperationError(error: unknown): never {
    const normalized = this.normalizeError(error);
    throw normalized;
  }

  private resetConnection(): void {
    this.wallet = null;
    this.connected = false;
    this.lastTransport = undefined;
    this.lastDeviceIdentifier = undefined;
  }
}
