import { DynamicHttpJsonRpcClient } from '@core/rpc/DynamicHttpJsonRpcClient';
import type {
  Address,
  ChainCallParams,
  EvmFeeEstimate,
  EvmUnsignedTransaction,
  HardwareSignResult,
  Hash,
  Hex,
  IChainProvider,
  IChainRpc,
  IHardwareSigner,
  ISigner,
  ISoftwareSigner,
  SignedTransaction,
  TransactionParams,
} from '@core/types';
import { NetworkType } from '@core/types';
import {
  computeAddress,
  getAddress,
  getBytes,
  hexlify,
  isAddress,
  JsonRpcProvider,
  keccak256,
  Signature,
  Transaction,
  toUtf8Bytes,
  verifyMessage as verifyEthersMessage,
  Wallet,
} from 'ethers';
import type { EndpointManager } from './EndpointManager';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface EthereumChainProviderOptions {
  chainId: string;
  networkId: string; // WatermelonDB Network.id
  endpointManager: EndpointManager;
}

type EthersProvider = JsonRpcProvider;

export class EthereumChainProvider implements IChainProvider {
  readonly chainId: string;
  readonly networkType = NetworkType.Ethereum;

  private readonly numericChainId: number;

  private readonly endpointManager: EndpointManager;
  private readonly networkId: string;

  private cachedEndpoint: string | null = null;
  private cachedProvider: EthersProvider | null = null;

  readonly rpc: IChainRpc;

  constructor({ chainId, networkId, endpointManager }: EthereumChainProviderOptions) {
    const numericChainId = Number(chainId);
    if (!Number.isFinite(numericChainId) || numericChainId <= 0) {
      throw new Error(`Invalid chainId: ${chainId}. Must be a positive number or hex string`);
    }

    this.chainId = chainId;
    this.numericChainId = numericChainId;

    this.networkId = networkId;
    this.endpointManager = endpointManager;

    this.rpc = new DynamicHttpJsonRpcClient({ endpointManager, networkId });
  }

  private getEthersProvider(): EthersProvider {
    const endpoint = this.endpointManager.getEndpointOrThrow(this.networkId);

    if (this.cachedProvider && this.cachedEndpoint === endpoint) {
      return this.cachedProvider;
    }

    const provider = new JsonRpcProvider(endpoint, this.numericChainId);
    this.cachedEndpoint = endpoint;
    this.cachedProvider = provider;
    return provider;
  }

  deriveAddress(publicKey: string): string {
    const address = computeAddress(publicKey);
    return getAddress(address);
  }

  validateAddress(address: Address): boolean {
    return isAddress(address);
  }
  async signTransaction(tx: EvmUnsignedTransaction, signer: ISigner, options?: { signal?: AbortSignal }): Promise<SignedTransaction> {
    if (signer.type === 'software') {
      return this.signWithSoftware(tx, signer);
    } else {
      return this.signWithHardware(tx, signer, options);
    }
  }

  private async signWithSoftware(tx: EvmUnsignedTransaction, signer: ISoftwareSigner): Promise<SignedTransaction> {
    const privateKey = signer.getPrivateKey();
    const wallet = new Wallet(privateKey, this.getEthersProvider());
    const raw = await wallet.signTransaction(tx.payload);
    const hash = keccak256(raw) as Hash;

    return {
      chainType: tx.chainType,
      rawTransaction: raw,
      hash,
    };
  }

  private async signWithHardware(tx: EvmUnsignedTransaction, signer: IHardwareSigner, options?: { signal?: AbortSignal }): Promise<SignedTransaction> {
    const result = await signer.signWithHardware({
      derivationPath: signer.getDerivationPath(),
      chainType: signer.getChainType(),
      payload: {
        payloadKind: 'transaction',
        chainType: tx.chainType,
        unsignedTx: tx.payload,
      },
      signal: options?.signal,
    });

    return this.assembleHardwareSignedTransaction(tx, result);
  }

  private assembleHardwareSignedTransaction(tx: EvmUnsignedTransaction, result: HardwareSignResult): SignedTransaction {
    if (result.chainType !== tx.chainType) {
      throw new Error('Hardware wallet returned mismatched chain type.');
    }

    if (result.resultType === 'rawTransaction') {
      return {
        chainType: tx.chainType,
        rawTransaction: result.rawTransaction,
        hash: result.hash,
      };
    }

    if (result.resultType === 'signature') {
      const transaction = Transaction.from({ ...tx.payload, from: undefined });
      transaction.signature = Signature.from({
        r: result.r,
        s: result.s,
        v: result.v ?? 27,
      });
      const rawTransaction = transaction.serialized as Hex;
      const hash = keccak256(rawTransaction) as Hash;

      return {
        chainType: tx.chainType,
        rawTransaction,
        hash,
      };
    }

    throw new Error('Hardware wallet returned unsupported result type for transactions.');
  }

  async signMessage(message: string, signer: ISigner): Promise<string> {
    const isHexBytes = message.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(message);
    const messageBytes = isHexBytes ? getBytes(message) : toUtf8Bytes(message);

    if (signer.type === 'software') {
      const privateKey = signer.getPrivateKey();
      const wallet = new Wallet(privateKey, this.getEthersProvider());
      return wallet.signMessage(messageBytes);
    } else {
      const result = await signer.signWithHardware({
        derivationPath: signer.getDerivationPath(),
        chainType: this.networkType,
        payload: {
          payloadKind: 'message',
          messageKind: 'personal',
          chainType: this.networkType,
          message: hexlify(messageBytes),
        },
        signal: undefined,
      });

      if (result.resultType === 'typedSignature') {
        return result.signature;
      }
      if (result.resultType === 'signature') {
        const v = result.v ?? 27;
        const yParity = (v % 2 === 0 ? 0 : 1) as 0 | 1;
        return Signature.from({ r: result.r, s: result.s, v, yParity }).serialized;
      }
      throw new Error('Hardware wallet did not return a message signature.');
    }
  }

  verifyMessage(message: string, signature: string, address: Address): boolean {
    try {
      const isHexBytes = message.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(message);
      const messageBytes = isHexBytes ? getBytes(message) : toUtf8Bytes(message);

      const recovered = verifyEthersMessage(messageBytes, signature);
      return getAddress(recovered) === getAddress(address);
    } catch {
      return false;
    }
  }

  async broadcastTransaction(signedTx: SignedTransaction): Promise<Hash> {
    const response = await this.getEthersProvider().broadcastTransaction(signedTx.rawTransaction);
    return response.hash as Hash;
  }

  async buildTransaction(params: TransactionParams): Promise<EvmUnsignedTransaction> {
    const payload = buildTransactionPayload({
      from: params.from,
      to: params.to,
      amount: params.amount,
      assetType: params.assetType,
      assetDecimals: params.assetDecimals,
      chainId: params.chainId,
      contractAddress: params.contractAddress,
      nftTokenId: params.nftTokenId,
    });

    const nonce = await this.resolveNonce(params.from, params.nonce);

    const txType = this.determineTransactionType(params);
    return {
      chainType: this.networkType,
      payload: {
        ...payload,
        gasLimit: params.gasLimit,
        gasPrice: params.gasPrice,
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas,
        nonce,
        type: txType,
      },
    };
  }

  private determineTransactionType(params: TransactionParams): number | undefined {
    if (params.maxFeePerGas || params.maxPriorityFeePerGas) return 2;
    if (params.gasPrice) return 0;
    return undefined;
  }

  async getBalance(address: Address): Promise<Hex> {
    const balance = await this.getEthersProvider().getBalance(address);
    return this.formatHex(balance);
  }

  async getNonce(address: Address): Promise<number> {
    const nonce = await this.getEthersProvider().getTransactionCount(address, 'pending');
    return nonce;
  }

  async call(params: ChainCallParams): Promise<Hex> {
    const { to, data } = params;
    const raw = await this.getEthersProvider().call({ to, data });
    return raw as Hex;
  }
  private async resolveNonce(address: Address, override?: number): Promise<number> {
    if (typeof override === 'number') {
      return override;
    }
    return this.getNonce(address);
  }

  async estimateFee(tx: EvmUnsignedTransaction): Promise<EvmFeeEstimate> {
    const { payload } = tx;

    const request = this.buildEstimateRequest(payload);
    const provider = this.getEthersProvider();
    const estimatedGas = this.toBigInt(payload.gasLimit) ?? (await provider.estimateGas(request));
    const feeData = await provider.getFeeData();

    const hasExplicit1559 = payload.maxFeePerGas !== undefined || payload.maxPriorityFeePerGas !== undefined || payload.type === 2;
    const networkSupports1559 = feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null;
    const use1559 = hasExplicit1559 || networkSupports1559;

    const gasPrice = this.toBigInt(payload.gasPrice) ?? feeData.gasPrice ?? 0n;
    const maxFeePerGas = use1559 ? (this.toBigInt(payload.maxFeePerGas) ?? feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n) : undefined;
    const maxPriorityFeePerGas = use1559 ? (this.toBigInt(payload.maxPriorityFeePerGas) ?? feeData.maxPriorityFeePerGas ?? 0n) : undefined;

    const effectivePrice = use1559 ? (maxFeePerGas ?? 0n) : gasPrice;
    const estimatedTotal = estimatedGas * effectivePrice;

    return {
      chainType: tx.chainType,
      gasLimit: this.formatHex(estimatedGas),
      estimatedTotal: this.formatHex(estimatedTotal),
      gasPrice: use1559 ? undefined : this.formatHex(gasPrice),
      maxFeePerGas: maxFeePerGas !== undefined ? this.formatHex(maxFeePerGas) : undefined,
      maxPriorityFeePerGas: maxPriorityFeePerGas !== undefined ? this.formatHex(maxPriorityFeePerGas) : undefined,
    };
  }

  private buildEstimateRequest(payload: EvmUnsignedTransaction['payload']) {
    return {
      from: payload.from,
      to: payload.to,
      data: payload.data,
      value: payload.value,
      nonce: payload.nonce,
      gasLimit: payload.gasLimit,
      gasPrice: payload.gasPrice,
      maxFeePerGas: payload.maxFeePerGas,
      maxPriorityFeePerGas: payload.maxPriorityFeePerGas,
      type: payload.type,
      chainId: Number(this.chainId),
    };
  }

  private toBigInt(value?: string): bigint | undefined {
    if (!value) return undefined;
    return BigInt(value);
  }

  private formatHex(value: bigint): Hex {
    return `0x${value.toString(16)}`;
  }
}
