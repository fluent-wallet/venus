import type {
  Address,
  ChainCallParams,
  ConfluxFeeEstimate,
  ConfluxUnsignedTransaction,
  ConfluxUnsignedTransactionPayload,
  HardwareSignResult,
  Hash,
  IChainProvider,
  IHardwareSigner,
  ISigner,
  ISoftwareSigner,
  SignedTransaction,
  TransactionParams,
} from '@core/types';
import { NetworkType } from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { type Base32Address, convertBase32ToHex, convertHexToBase32, decode } from '@core/utils/address';
import { Conflux, PersonalMessage, PrivateKeyAccount } from 'js-conflux-sdk';
import type { Hex } from 'ox/Hex';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface ConfluxChainProviderOptions {
  chainId: string;
  endpoint: string;
  netId: number;
}

type ConfluxRpcClient = {
  getBalance(address: string, epochNumber?: string | number): Promise<bigint>;
  getNextNonce(address: string, epochNumber?: string | number): Promise<bigint>;
  getEpochNumber(epochNumber?: string | number): Promise<number>;
  estimateGasAndCollateral(
    params: { from: string; to?: string; data?: string; value?: string },
    epochNumber?: string | number,
  ): Promise<{ gasUsed: bigint; gasLimit: bigint; storageCollateralized: bigint }>;
  getGasPrice(): Promise<bigint>;
};

export class ConfluxChainProvider implements IChainProvider {
  readonly chainId: string;
  readonly networkType = NetworkType.Conflux;
  readonly netId: number;
  private readonly cfx: Conflux;
  private readonly rpc: ConfluxRpcClient;

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
    this.netId = netId;
    this.cfx = new Conflux({ url: endpoint, networkId: netId });
    this.rpc = this.cfx.cfx as ConfluxRpcClient;
  }

  deriveAddress(publicKey: Hex): string {
    const accountHex = toAccountAddress(computeAddress(publicKey));
    return convertHexToBase32(accountHex, this.netId);
  }

  validateAddress(address: Address): boolean {
    try {
      const decoded = decode(address);
      if (decoded.netId !== this.netId) {
        throw new Error(`Address netId ${decoded.netId} does not match provider netId ${this.netId}`);
      }
      return true;
    } catch {
      return false;
    }
  }

  async buildTransaction(params: TransactionParams): Promise<ConfluxUnsignedTransaction> {
    const basePayload = buildTransactionPayload({
      from: params.from,
      to: params.to,
      amount: params.amount,
      assetType: params.assetType,
      assetDecimals: params.assetDecimals,
      chainId: params.chainId,
      contractAddress: params.contractAddress,
      nftTokenId: params.nftTokenId,
    });

    const payload: ConfluxUnsignedTransactionPayload = {
      ...basePayload,
      gasLimit: params.gasLimit,
      gasPrice: params.gasPrice,
      storageLimit: params.storageLimit,
      nonce: await this.resolveNonce(params.from, params.nonce),
      epochHeight: await this.resolveEpochHeight(params.epochHeight),
    };

    return this.toUnsignedTransaction(payload);
  }

  async estimateFee(tx: ConfluxUnsignedTransaction): Promise<ConfluxFeeEstimate> {
    const { payload } = tx;
    const { gasUsed, storageCollateralized } = await this.rpc.estimateGasAndCollateral({
      from: payload.from,
      to: payload.to,
      data: payload.data,
      value: payload.value,
    });

    const gasPrice = payload.gasPrice ? BigInt(payload.gasPrice) : await this.rpc.getGasPrice();

    return this.toFeeEstimate(payload, this.toBigInt(gasUsed), this.toBigInt(storageCollateralized), this.toBigInt(gasPrice));
  }

  async signTransaction(tx: ConfluxUnsignedTransaction, signer: ISigner): Promise<SignedTransaction> {
    if (signer.type === 'software') {
      return this.signWithSoftware(tx, signer);
    } else {
      return this.signWithHardware(tx, signer);
    }
  }

  private async signWithSoftware(tx: ConfluxUnsignedTransaction, signer: ISoftwareSigner): Promise<SignedTransaction> {
    const privateKey = signer.getPrivateKey();
    const account = new PrivateKeyAccount(privateKey, this.netId);
    const signed = await account.signTransaction({
      ...tx.payload,
      gas: tx.payload.gasLimit,
    });

    return {
      chainType: tx.chainType,
      rawTransaction: signed.serialize(),
      hash: signed.hash ?? '',
    };
  }

  private async signWithHardware(tx: ConfluxUnsignedTransaction, signer: IHardwareSigner): Promise<SignedTransaction> {
    await signer.signWithHardware({
      derivationPath: signer.getDerivationPath(),
      chainType: signer.getChainType(),
      payload: {
        payloadKind: 'transaction',
        chainType: tx.chainType,
        unsignedTx: tx.payload,
      },
    });

    throw new Error('Hardware signing for Conflux transactions is not supported yet.');
  }

  private assembleHardwareSignedTransaction(tx: ConfluxUnsignedTransaction, result: HardwareSignResult): SignedTransaction {
    // TODO: implement hardware transaction assembly based on BSIM signature format
    throw new Error('Hardware transaction assembly not implemented');
  }

  async broadcastTransaction(signedTx: SignedTransaction): Promise<Hash> {
    return this.cfx.sendRawTransaction(signedTx.rawTransaction);
  }

  async getBalance(address: Address): Promise<Hex> {
    const raw = await this.rpc.getBalance(address, 'latest_state');
    return this.formatHex(raw);
  }

  async getNonce(address: Address): Promise<number> {
    const result = await this.rpc.getNextNonce(address, 'latest_state');
    return this.toNumber(result);
  }

  async call(params: ChainCallParams): Promise<Hex> {
    const { to, data } = params;
    const result = await this.cfx.call({ to, data });
    return this.formatHex(result);
  }

  async signMessage(message: string, signer: ISigner): Promise<string> {
    if (signer.type === 'software') {
      const privateKey = signer.getPrivateKey();
      return PersonalMessage.sign(privateKey, message);
    } else {
      await signer.signWithHardware({
        derivationPath: signer.getDerivationPath(),
        chainType: this.networkType,
        payload: {
          payloadKind: 'message',
          messageKind: 'personal',
          chainType: this.networkType,
          message,
        },
      });

      throw new Error('Hardware signing for Conflux messages is not supported yet.');
    }
  }

  verifyMessage(message: string, signature: string, address: Address): boolean {
    try {
      const decoded = decode(address);
      if (decoded.netId !== this.netId) return false;
      const recoveredPubKey = PersonalMessage.recover(signature, message);
      const recoveredHex = toAccountAddress(computeAddress(recoveredPubKey));
      const expectedHex = toAccountAddress(convertBase32ToHex(address as Base32Address));

      return recoveredHex.toLowerCase() === expectedHex.toLowerCase();
    } catch {
      return false;
    }
  }

  private async resolveNonce(address: Address, override?: number): Promise<number> {
    if (typeof override === 'number') return override;
    return this.getNonce(address);
  }

  private async resolveEpochHeight(override?: number): Promise<number> {
    if (typeof override === 'number') return override;
    const epoch = await this.rpc.getEpochNumber('latest_state');
    return this.toNumber(epoch);
  }

  private toUnsignedTransaction(payload: ConfluxUnsignedTransactionPayload): ConfluxUnsignedTransaction {
    return {
      chainType: this.networkType,
      payload,
    };
  }

  private toFeeEstimate(payload: ConfluxUnsignedTransactionPayload, gasUsed: bigint, storageCollateralized: bigint, gasPrice: bigint): ConfluxFeeEstimate {
    const gasLimit = payload.gasLimit ? BigInt(payload.gasLimit) : gasUsed;
    const storageLimit = payload.storageLimit ? BigInt(payload.storageLimit) : storageCollateralized;
    const estimatedTotal = gasLimit * gasPrice + storageLimit;

    return {
      chainType: this.networkType,
      gasLimit: `0x${gasLimit.toString(16)}`,
      gasPrice: `0x${gasPrice.toString(16)}`,
      storageLimit: `0x${storageLimit.toString(16)}`,
      estimatedTotal: `0x${estimatedTotal.toString(16)}`,
    };
  }

  /**
   * conflux sdk returns bigint is JSBI not native bigint so we need to format it
   * @param value
   * @returns
   */
  private formatHex(value: unknown): Hex {
    const normalized = this.toBigInt(value);
    return `0x${normalized.toString(16)}` as Hex;
  }

  private toBigInt(value: unknown): bigint {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string') return BigInt(value);
    if (value && typeof (value as { toString(): string }).toString === 'function') {
      return BigInt((value as { toString(): string }).toString());
    }
    throw new Error(`Unable to convert value '${String(value)}' to bigint`);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'string') {
      return value.startsWith('0x') ? Number(BigInt(value)) : Number(value);
    }
    if (value && typeof (value as { toString(): string }).toString === 'function') {
      return this.toNumber((value as { toString(): string }).toString());
    }
    throw new Error(`Unable to convert value '${String(value)}' to number`);
  }
}
