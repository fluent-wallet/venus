import { iface777 } from '@core/contracts';
import ESpaceWalletABI from '@core/contracts/ABI/ESpaceWallet';
import { DynamicHttpJsonRpcClient } from '@core/rpc/DynamicHttpJsonRpcClient';
import type {
  Address,
  ChainCallParams,
  EvmFeeEstimate,
  EvmUnsignedTransaction,
  FungibleAssetBalanceRequest,
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
import { NetworkType } from '@core/utils/consts';
import {
  computeAddress,
  getAddress,
  getBytes,
  hexlify,
  Interface,
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
import { getESpaceChainConfig } from './eSpaceConfig';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface EthereumChainProviderOptions {
  chainId: string;
  networkId: string; // WatermelonDB Network.id
  endpointManager: EndpointManager;
}

type EthersProvider = JsonRpcProvider;

const eSpaceWalletIface = new Interface(ESpaceWalletABI);
const E_SPACE_GET_BALANCES_SIGNATURE = 'getBalances(address,address[])';
const EVM_NATIVE_TOKEN_PLACEHOLDER = '0x0000000000000000000000000000000000000000';

export class EthereumChainProvider implements IChainProvider<EvmUnsignedTransaction, EvmFeeEstimate> {
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

  async prepareUnsignedTransaction(tx: EvmUnsignedTransaction): Promise<EvmUnsignedTransaction> {
    return this.finalizePreparedTransaction(tx);
  }

  async signTransaction(tx: EvmUnsignedTransaction, signer: ISigner, options?: { signal?: AbortSignal }): Promise<SignedTransaction<NetworkType.Ethereum>> {
    if (signer.type === 'software') {
      return this.signWithSoftware(tx, signer);
    } else {
      return this.signWithHardware(tx, signer, options);
    }
  }

  private async signWithSoftware(tx: EvmUnsignedTransaction, signer: ISoftwareSigner): Promise<SignedTransaction<NetworkType.Ethereum>> {
    const privateKey = signer.getPrivateKey();
    const wallet = new Wallet(privateKey, this.getEthersProvider());
    const payload = this.resolvePreparedPayload(tx.payload);
    // ethers mutates the input object and deletes `from` after validation.
    const raw = await wallet.signTransaction({ ...payload });
    const hash = keccak256(raw) as Hash;

    return {
      chainType: tx.chainType,
      rawTransaction: raw,
      hash,
    };
  }

  private async signWithHardware(
    tx: EvmUnsignedTransaction,
    signer: IHardwareSigner,
    options?: { signal?: AbortSignal },
  ): Promise<SignedTransaction<NetworkType.Ethereum>> {
    const payload = this.resolvePreparedPayload(tx.payload);
    const result = await signer.signWithHardware({
      derivationPath: signer.getDerivationPath(),
      chainType: signer.getChainType(),
      payload: {
        payloadKind: 'transaction',
        chainType: tx.chainType,
        unsignedTx: payload,
      },
      signal: options?.signal,
    });

    return this.assembleHardwareSignedTransaction({ ...tx, payload }, result);
  }

  private assembleHardwareSignedTransaction(tx: EvmUnsignedTransaction, result: HardwareSignResult): SignedTransaction<NetworkType.Ethereum> {
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

    const feeFields = this.resolveFeeFields({
      type: this.determineTransactionType(params),
      gasPrice: params.gasPrice,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    });
    return {
      chainType: this.networkType,
      payload: {
        ...payload,
        gasLimit: params.gasLimit,
        gasPrice: feeFields.gasPrice,
        maxFeePerGas: feeFields.maxFeePerGas,
        maxPriorityFeePerGas: feeFields.maxPriorityFeePerGas,
        nonce,
        type: feeFields.type,
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

  async batchCall(params: readonly ChainCallParams[]): Promise<Hex[]> {
    if (params.length === 0) {
      return [];
    }

    return this.rpc.batch<Hex>(
      params.map(({ to, data }) => ({
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      })),
    );
  }

  async readFungibleAssetBalances(address: Address, requests: readonly FungibleAssetBalanceRequest[]): Promise<ReadonlyArray<Hex | null>> {
    if (requests.length === 0) {
      return [];
    }

    const eSpaceWalletContract = this.getESpaceWalletContract();
    if (eSpaceWalletContract && requests.some((request) => request.assetType === 'ERC20')) {
      try {
        return await this.readESpaceFungibleAssetBalances(address, requests, eSpaceWalletContract);
      } catch {
        // Fall through to the generic path if the eSpace wallet call is unavailable.
      }
    }

    return this.readGenericFungibleAssetBalances(address, requests);
  }

  private async resolveNonce(address: Address, override?: number): Promise<number> {
    if (typeof override === 'number') {
      return override;
    }
    return this.getNonce(address);
  }

  private async readESpaceFungibleAssetBalances(
    address: Address,
    requests: readonly FungibleAssetBalanceRequest[],
    walletContract: string,
  ): Promise<ReadonlyArray<Hex | null>> {
    const tokens = requests.map((request) => (request.assetType === 'Native' ? EVM_NATIVE_TOKEN_PLACEHOLDER : request.contractAddress));
    const raw = await this.rpc.request<Hex>('eth_call', [
      {
        to: walletContract,
        data: eSpaceWalletIface.encodeFunctionData(E_SPACE_GET_BALANCES_SIGNATURE, [address, tokens]) as Hex,
      },
      'latest',
    ]);

    if (!raw || raw === '0x') {
      return requests.map(() => null);
    }

    const decoded = eSpaceWalletIface.decodeFunctionResult(E_SPACE_GET_BALANCES_SIGNATURE, raw);
    const decodedBalances = (Array.isArray(decoded[0]) ? decoded[0] : []) as unknown[];

    return requests.map((_, index) => {
      const value = decodedBalances?.[index];
      return value == null ? null : this.formatHex(BigInt(value as bigint | number | string));
    });
  }

  private async readGenericFungibleAssetBalances(address: Address, requests: readonly FungibleAssetBalanceRequest[]): Promise<ReadonlyArray<Hex | null>> {
    const results: Array<Hex | null> = new Array(requests.length).fill(null);
    const nativeIndexes: number[] = [];
    const rpcRequests: Array<{ method: string; params: unknown[] }> = [];
    const responseBindings: Array<{ kind: 'native'; indexes: number[] } | { kind: 'erc20'; index: number }> = [];

    requests.forEach((request, index) => {
      if (request.assetType === 'Native') {
        nativeIndexes.push(index);
        return;
      }

      rpcRequests.push({
        method: 'eth_call',
        params: [
          {
            to: request.contractAddress,
            data: this.encodeErc20BalanceOf(address),
          },
          'latest',
        ],
      });
      responseBindings.push({ kind: 'erc20', index });
    });

    if (nativeIndexes.length > 0) {
      rpcRequests.unshift({ method: 'eth_getBalance', params: [address, 'latest'] });
      responseBindings.unshift({ kind: 'native', indexes: nativeIndexes });
    }

    try {
      const raws = await this.rpc.batch<Hex>(rpcRequests);
      responseBindings.forEach((binding, index) => {
        const raw = raws[index] ?? null;
        if (binding.kind === 'native') {
          binding.indexes.forEach((nativeIndex) => {
            results[nativeIndex] = raw;
          });
          return;
        }

        results[binding.index] = raw;
      });

      return results;
    } catch {
      return Promise.all(
        requests.map(async (request) => {
          try {
            if (request.assetType === 'Native') {
              return await this.getBalance(address);
            }

            return await this.call({
              to: request.contractAddress,
              data: this.encodeErc20BalanceOf(address),
            });
          } catch {
            return null;
          }
        }),
      );
    }
  }

  async estimateFee(tx: EvmUnsignedTransaction): Promise<EvmFeeEstimate> {
    const provider = this.getEthersProvider();
    const feeData = await provider.getFeeData();
    const networkSupports1559 = feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null;
    const payload = this.resolvePreparedPayload(tx.payload, { networkSupports1559 });
    const request = this.buildEstimateRequest(payload);
    const estimatedGas = this.toBigInt(payload.gasLimit) ?? (await provider.estimateGas(request));
    const use1559 = payload.type === 2;
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

  private async finalizePreparedTransaction(tx: EvmUnsignedTransaction): Promise<EvmUnsignedTransaction> {
    const payload = tx.payload;
    const nonce = await this.resolveNonce(payload.from, payload.nonce);
    const estimate = await this.estimateFee({
      ...tx,
      payload: {
        ...payload,
        nonce,
      },
    });
    const networkSupports1559 = estimate.maxFeePerGas != null && estimate.maxPriorityFeePerGas != null;
    const feeFields = this.resolveFeeFields(
      {
        type: payload.type,
        gasPrice: payload.gasPrice ?? estimate.gasPrice,
        maxFeePerGas: payload.maxFeePerGas ?? estimate.maxFeePerGas,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas ?? estimate.maxPriorityFeePerGas,
      },
      { networkSupports1559 },
    );

    return {
      ...tx,
      payload: {
        ...payload,
        gasLimit: payload.gasLimit ?? estimate.gasLimit,
        gasPrice: feeFields.gasPrice,
        maxFeePerGas: feeFields.maxFeePerGas,
        maxPriorityFeePerGas: feeFields.maxPriorityFeePerGas,
        nonce,
        type: feeFields.type,
      },
    };
  }

  private resolvePreparedPayload(payload: EvmUnsignedTransaction['payload'], options?: { networkSupports1559?: boolean }): EvmUnsignedTransaction['payload'] {
    const feeFields = this.resolveFeeFields(
      {
        type: payload.type,
        gasPrice: payload.gasPrice,
        maxFeePerGas: payload.maxFeePerGas,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas,
      },
      options,
    );

    return {
      ...payload,
      type: feeFields.type,
      gasPrice: feeFields.gasPrice,
      maxFeePerGas: feeFields.maxFeePerGas,
      maxPriorityFeePerGas: feeFields.maxPriorityFeePerGas,
    };
  }

  private resolveFeeFields(
    input: {
      type?: number;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    },
    options: { networkSupports1559?: boolean } = {},
  ) {
    const hasLegacyFee = input.gasPrice !== undefined;
    const has1559Fee = input.maxFeePerGas !== undefined || input.maxPriorityFeePerGas !== undefined;
    const isExplicitLegacy = input.type === 0 || input.type === 1;
    const isExplicit1559 = input.type === 2;

    if (isExplicit1559 || (!isExplicitLegacy && (has1559Fee || (!hasLegacyFee && options.networkSupports1559)))) {
      this.assertValidEip1559Fees({
        maxFeePerGas: input.maxFeePerGas,
        maxPriorityFeePerGas: input.maxPriorityFeePerGas,
      });
      return {
        type: input.type ?? 2,
        gasPrice: undefined,
        maxFeePerGas: input.maxFeePerGas,
        maxPriorityFeePerGas: input.maxPriorityFeePerGas,
      };
    }

    if (isExplicitLegacy || hasLegacyFee) {
      return {
        type: input.type ?? (hasLegacyFee ? 0 : undefined),
        gasPrice: input.gasPrice,
        maxFeePerGas: undefined,
        maxPriorityFeePerGas: undefined,
      };
    }

    return {
      type: input.type,
      gasPrice: input.gasPrice,
      maxFeePerGas: input.maxFeePerGas,
      maxPriorityFeePerGas: input.maxPriorityFeePerGas,
    };
  }

  private assertValidEip1559Fees(input: { maxFeePerGas?: string; maxPriorityFeePerGas?: string }) {
    if (!input.maxFeePerGas || !input.maxPriorityFeePerGas) return;
    if (BigInt(input.maxFeePerGas) < BigInt(input.maxPriorityFeePerGas)) {
      throw new Error('maxFeePerGas cannot be lower than maxPriorityFeePerGas.');
    }
  }

  private getESpaceWalletContract(): string | null {
    return getESpaceChainConfig(this.chainId)?.walletContract ?? null;
  }

  private encodeErc20BalanceOf(address: Address): Hex {
    return iface777.encodeFunctionData('balanceOf', [address]) as Hex;
  }

  private toBigInt(value?: string): bigint | undefined {
    if (!value) return undefined;
    return BigInt(value);
  }

  private formatHex(value: bigint): Hex {
    return `0x${value.toString(16)}`;
  }
}
