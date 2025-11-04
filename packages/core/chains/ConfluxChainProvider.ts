import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import type { Address, ChainType, FeeEstimate, Hash, Hex, IChainProvider, SignedTransaction, TransactionParams, UnsignedTransaction } from '@core/types';
import { TxStatus } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { computeAddress, isCfxHexAddress, toAccountAddress } from '@core/utils/account';
import { convertBase32ToHex, convertHexToBase32, decode, validateHexAddress, type Base32Address } from '@core/utils/address';
import { checksum } from 'ox/Address';

export function hexToNumber(value: string): number {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Expected non-empty string');
  }

  if (value.startsWith('0x') || value.startsWith('0X')) {
    return Number(BigInt(value));
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to convert value '${value}' to number`);
  }
  return parsed;
}

type DeriveAddressFormat = 'hex' | 'base32';

export interface ConfluxChainProviderOptions {
  chainId: string;
  endpoint: string;
  netId: number;
}

export class ConfluxChainProvider implements IChainProvider {
  readonly chainId: string;
  readonly networkType: ChainType = NetworkType.Conflux;
  readonly netId: number;

  private readonly endpoint: string;

  constructor({ chainId, endpoint, netId }: ConfluxChainProviderOptions) {
    if (!chainId) {
      throw new Error('chainId is required');
    }

    if (!endpoint) {
      throw new Error('endpoint is required');
    }

    if (!Number.isInteger(netId) || netId <= 0) {
      throw new Error('netId must be a positive integer');
    }

    this.chainId = chainId;
    this.endpoint = endpoint;
    this.netId = netId;
  }

  deriveAddress(publicKey: Hex, params?: { format?: DeriveAddressFormat }): string {
    const accountHex = this.ensureConfluxHex(toAccountAddress(computeAddress(publicKey)));

    if (params?.format === 'hex') {
      return checksum(accountHex);
    }

    return convertHexToBase32(accountHex, this.netId);
  }

  validateAddress(address: Address): boolean {
    return this.tryDecodeBase32(address) !== null;
  }

  prepareAddressForAbi(address: Address): string {
    const decoded = this.tryDecodeBase32(address);
    if (decoded) {
      return checksum(decoded.hex);
    }

    return this.ensureConfluxHex(address);
  }

  async buildTransaction(_params: TransactionParams): Promise<UnsignedTransaction> {
    throw new Error('ConfluxChainProvider.buildTransaction is not implemented yet');
  }

  async estimateFee(_tx: UnsignedTransaction): Promise<FeeEstimate> {
    throw new Error('ConfluxChainProvider.estimateFee is not implemented yet');
  }

  async signTransaction(_tx: UnsignedTransaction, _signer: unknown): Promise<SignedTransaction> {
    throw new Error('ConfluxChainProvider.signTransaction is not implemented yet');
  }

  async broadcastTransaction(_signedTx: SignedTransaction): Promise<Hash> {
    throw new Error('ConfluxChainProvider.broadcastTransaction is not implemented yet');
  }

  async getBalance(address: Address): Promise<string> {
    const base32 = this.toBase32(address);
    return fetchChain<string>({
      url: this.endpoint,
      method: 'cfx_getBalance',
      params: [base32, 'latest_state'],
    });
  }

  async getTransactionStatus(txHash: Hash): Promise<TxStatus> {
    const receipt = await fetchChain<{ outcomeStatus?: string } | null>({
      url: this.endpoint,
      method: 'cfx_getTransactionReceipt',
      params: [txHash],
    });

    if (!receipt || typeof receipt.outcomeStatus !== 'string') {
      return TxStatus.Pending;
    }

    return receipt.outcomeStatus === '0x0' ? TxStatus.Confirmed : TxStatus.Failed;
  }

  async getNonce(address: Address): Promise<number> {
    const base32 = this.toBase32(address);
    const value = await fetchChain<string>({
      url: this.endpoint,
      method: 'cfx_getNextNonce',
      params: [base32, 'latest_state'],
    });

    return hexToNumber(value);
  }

  async signMessage(_message: string, _signer: unknown): Promise<string> {
    throw new Error('ConfluxChainProvider.signMessage is not implemented yet');
  }

  verifyMessage(): boolean {
    throw new Error('ConfluxChainProvider.verifyMessage is not implemented yet');
  }

  async getEpochNumber(): Promise<number> {
    const epoch = await fetchChain<string>({
      url: this.endpoint,
      method: 'cfx_epochNumber',
      params: ['latest_state'],
    });

    return hexToNumber(epoch);
  }

  async isSupport1559(): Promise<boolean> {
    const block = await fetchChain<{ baseFeePerGas?: string } | null>({
      url: this.endpoint,
      method: 'cfx_getBlockByEpochNumber',
      params: ['latest_state', false],
    });

    return Boolean(block?.baseFeePerGas);
  }

  private tryDecodeBase32(address: string): { hex: `0x${string}` } | null {
    try {
      const decoded = decode(address);
      if (decoded.netId !== this.netId) {
        throw new Error(`Address netId ${decoded.netId} does not match provider netId ${this.netId}`);
      }

      const hex = convertBase32ToHex(address as Base32Address);
      return { hex: this.ensureConfluxHex(hex) };
    } catch {
      return null;
    }
  }

  private ensureConfluxHex(address: string): Hex {
    if (!validateHexAddress(address)) {
      throw new Error(`Invalid hex address: ${address}`);
    }

    const normalized = `0x${address.slice(2).toLowerCase()}` as Hex;
    if (!isCfxHexAddress(normalized)) {
      throw new Error(`Address ${normalized} is not a valid Conflux hex address`);
    }

    return checksum(normalized);
  }

  private toBase32(address: Address): string {
    const decoded = this.tryDecodeBase32(address);
    if (decoded) {
      return address;
    }

    const hex = this.ensureConfluxHex(address);
    return convertHexToBase32(hex, this.netId);
  }
}
