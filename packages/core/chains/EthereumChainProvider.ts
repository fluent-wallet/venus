import { JsonRpcProvider, Wallet, computeAddress, getAddress, isAddress, keccak256, verifyMessage as verifyEthersMessage } from 'ethers';
import type { Address, ChainCallParams, EvmFeeEstimate, EvmUnsignedTransaction, Hex, IChainProvider, SignedTransaction, TransactionParams } from '@core/types';
import { NetworkType } from '@core/types';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface EthereumChainProviderOptions {
  chainId: string;
  endpoint: string;
}

type EthersProvider = JsonRpcProvider;

export class EthereumChainProvider implements IChainProvider {
  readonly chainId: string;
  readonly networkType = NetworkType.Ethereum;
  private readonly provider: EthersProvider;

  constructor({ chainId, endpoint }: EthereumChainProviderOptions) {
    if (!chainId) {
      throw new Error('chainId is required');
    }
    if (!endpoint) {
      throw new Error('endpoint is required');
    }

    const numericChainId = Number(chainId);
    if (!Number.isFinite(numericChainId) || numericChainId <= 0) {
      throw new Error(`Invalid chainId: ${chainId}. Must be a positive number or hex string`);
    }
    this.chainId = chainId;
    this.provider = new JsonRpcProvider(endpoint, numericChainId);
  }

  deriveAddress(publicKey: string): string {
    const address = computeAddress(publicKey);
    return getAddress(address);
  }

  validateAddress(address: Address): boolean {
    return isAddress(address);
  }
  async signTransaction(tx: EvmUnsignedTransaction, signer: { privateKey?: string }): Promise<SignedTransaction> {
    const privateKey = this.requirePrivateKey(signer);
    const wallet = new Wallet(privateKey, this.provider);
    const raw = await wallet.signTransaction(tx.payload);
    const hash = keccak256(raw);

    return {
      chainType: tx.chainType,
      rawTransaction: raw,
      hash,
    };
  }

  async signMessage(message: string, signer: { privateKey?: string }): Promise<string> {
    const privateKey = this.requirePrivateKey(signer);
    const wallet = new Wallet(privateKey, this.provider);
    return wallet.signMessage(message);
  }

  verifyMessage(message: string, signature: string, address: Address): boolean {
    try {
      const recovered = verifyEthersMessage(message, signature);
      return getAddress(recovered) === getAddress(address);
    } catch {
      return false;
    }
  }

  async broadcastTransaction(signedTx: SignedTransaction): Promise<string> {
    const response = await this.provider.broadcastTransaction(signedTx.rawTransaction);
    return response.hash;
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
    const balance = await this.provider.getBalance(address);
    return this.formatHex(balance);
  }

  async getNonce(address: Address): Promise<number> {
    const nonce = await this.provider.getTransactionCount(address, 'pending');
    return nonce;
  }

  async call(params: ChainCallParams): Promise<Hex> {
    const { to, data } = params;
    const raw = await this.provider.call({ to, data });
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
    const estimatedGas = this.toBigInt(payload.gasLimit) ?? (await this.provider.estimateGas(request));
    const feeData = await this.provider.getFeeData();

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

  private requirePrivateKey(signer: { privateKey?: string }): string {
    if (!signer.privateKey) {
      throw new Error('Signer must provide a privateKey');
    }
    return signer.privateKey;
  }
}
