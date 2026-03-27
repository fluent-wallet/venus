import { iface777 } from '@core/contracts';
import { DynamicHttpJsonRpcClient } from '@core/rpc/DynamicHttpJsonRpcClient';
import type {
  Address,
  ChainCallParams,
  ConfluxFeeEstimate,
  ConfluxUnsignedTransaction,
  ConfluxUnsignedTransactionPayload,
  FungibleAssetBalanceRequest,
  HardwareSignResult,
  Hash,
  IChainProvider,
  IChainRpc,
  IHardwareSigner,
  ISigner,
  ISoftwareSigner,
  SignedTransaction,
  TransactionParams,
} from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { type Base32Address, convertBase32ToHex, convertHexToBase32, decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import { Conflux, PersonalMessage, PrivateKeyAccount } from 'js-conflux-sdk';
import type { Hex } from 'ox/Hex';
import type { EndpointManager } from './EndpointManager';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface ConfluxChainProviderOptions {
  chainId: string;
  netId: number;

  networkId: string; // WatermelonDB Network.id
  endpointManager: EndpointManager;
}

type ConfluxEstimateRequest = {
  from: string;
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  nonce?: number;
  storageLimit?: string;
  type?: number;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

type ConfluxRpcClient = {
  getBalance(address: string, epochNumber?: string | number): Promise<bigint>;
  getNextNonce(address: string, epochNumber?: string | number): Promise<bigint>;
  getEpochNumber(epochNumber?: string | number): Promise<number>;
  getBlockByEpochNumber(epochNumber: string | number, includeTransactions: boolean): Promise<{ baseFeePerGas?: unknown } | null>;
  estimateGasAndCollateral(
    params: ConfluxEstimateRequest,
    epochNumber?: string | number,
  ): Promise<{
    gasUsed: bigint;
    gasLimit: bigint;
    storageCollateralized: bigint;
  }>;
  getGasPrice(): Promise<bigint>;
  maxPriorityFeePerGas(): Promise<bigint>;
};

export class ConfluxChainProvider implements IChainProvider<ConfluxUnsignedTransaction, ConfluxFeeEstimate> {
  readonly chainId: string;
  readonly networkType = NetworkType.Conflux;
  readonly netId: number;

  private readonly endpointManager: EndpointManager;
  private readonly networkId: string;

  private cachedEndpoint: string | null = null;
  private cachedCfx: Conflux | null = null;
  private cachedSdkRpc: ConfluxRpcClient | null = null;

  readonly rpc: IChainRpc;

  constructor({ chainId, netId, networkId, endpointManager }: ConfluxChainProviderOptions) {
    this.chainId = chainId;
    this.netId = netId;

    this.networkId = networkId;
    this.endpointManager = endpointManager;

    this.rpc = new DynamicHttpJsonRpcClient({ endpointManager, networkId });
  }

  private getConfluxClients(): { cfx: Conflux; sdkRpc: ConfluxRpcClient } {
    const endpoint = this.endpointManager.getEndpointOrThrow(this.networkId);

    if (this.cachedCfx && this.cachedSdkRpc && this.cachedEndpoint === endpoint) {
      return { cfx: this.cachedCfx, sdkRpc: this.cachedSdkRpc };
    }

    const cfx = new Conflux({ url: endpoint, networkId: this.netId });
    const sdkRpc = cfx.cfx as ConfluxRpcClient;

    this.cachedEndpoint = endpoint;
    this.cachedCfx = cfx;
    this.cachedSdkRpc = sdkRpc;

    return { cfx, sdkRpc };
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

  async prepareUnsignedTransaction(tx: ConfluxUnsignedTransaction): Promise<ConfluxUnsignedTransaction> {
    return this.populateUnsignedTransaction(tx);
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
    const feeFields = this.canonicalizeFeeFields({
      gasPrice: params.gasPrice,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    });

    const payload: ConfluxUnsignedTransactionPayload = {
      ...basePayload,
      gasLimit: params.gasLimit,
      ...feeFields,
      storageLimit: params.storageLimit,
      nonce: await this.getNonceOrProvided(params.from, params.nonce),
      epochHeight: await this.getEpochHeightOrLatest(params.epochHeight),
    };

    return this.toUnsignedTransaction(payload);
  }

  async estimateFee(tx: ConfluxUnsignedTransaction): Promise<ConfluxFeeEstimate> {
    const draft = tx.payload;
    const { sdkRpc } = this.getConfluxClients();
    const baseFeePerGas = await this.getBaseFeePerGas(draft.epochHeight);
    const payload = this.canonicalizePayload(draft, { networkSupports1559: baseFeePerGas !== undefined });
    const { gasUsed, storageCollateralized } = await sdkRpc.estimateGasAndCollateral(this.buildEstimateRequest(payload), payload.epochHeight ?? 'latest_state');
    const estimatedGas = this.toBigInt(gasUsed);
    const estimatedStorage = this.toBigInt(storageCollateralized);

    if (payload.type === 2) {
      return this.estimateEip1559Fee(payload, estimatedGas, estimatedStorage, baseFeePerGas);
    }

    return this.estimateLegacyFee(payload, estimatedGas, estimatedStorage);
  }
  async signTransaction(tx: ConfluxUnsignedTransaction, signer: ISigner): Promise<SignedTransaction<NetworkType.Conflux>> {
    if (signer.type === 'software') {
      return this.signWithSoftware(tx, signer);
    } else {
      return this.signWithHardware(tx, signer);
    }
  }

  private async signWithSoftware(tx: ConfluxUnsignedTransaction, signer: ISoftwareSigner): Promise<SignedTransaction<NetworkType.Conflux>> {
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

  private async signWithHardware(tx: ConfluxUnsignedTransaction, signer: IHardwareSigner): Promise<SignedTransaction<NetworkType.Conflux>> {
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

  private assembleHardwareSignedTransaction(tx: ConfluxUnsignedTransaction, result: HardwareSignResult): SignedTransaction<NetworkType.Conflux> {
    // TODO: implement hardware transaction assembly based on BSIM signature format
    throw new Error('Hardware transaction assembly not implemented');
  }

  async broadcastTransaction(signedTx: SignedTransaction): Promise<Hash> {
    const { cfx } = this.getConfluxClients();
    return cfx.sendRawTransaction(signedTx.rawTransaction);
  }
  async getBalance(address: Address): Promise<Hex> {
    const { sdkRpc } = this.getConfluxClients();
    const raw = await sdkRpc.getBalance(address, 'latest_state');
    return this.formatHex(raw);
  }
  async getNonce(address: Address): Promise<number> {
    const { sdkRpc } = this.getConfluxClients();
    const result = await sdkRpc.getNextNonce(address, 'latest_state');
    return this.toNumber(result);
  }

  async call(params: ChainCallParams): Promise<Hex> {
    const { cfx } = this.getConfluxClients();
    const { to, data } = params;
    const result = await cfx.call({ to, data });
    return this.formatHex(result);
  }

  async batchCall(params: readonly ChainCallParams[]): Promise<Hex[]> {
    if (params.length === 0) {
      return [];
    }

    return this.rpc.batch<Hex>(
      params.map(({ to, data }) => ({
        method: 'cfx_call',
        params: [{ to, data }, 'latest_state'],
      })),
    );
  }

  async readFungibleAssetBalances(address: Address, requests: readonly FungibleAssetBalanceRequest[]): Promise<ReadonlyArray<Hex | null>> {
    if (requests.length === 0) {
      return [];
    }

    const results: Array<Hex | null> = new Array(requests.length).fill(null);
    const nativeIndexes: number[] = [];
    const rpcRequests: Array<{ method: string; params: unknown[] }> = [];
    const responseBindings: Array<{ kind: 'native'; indexes: number[] } | { kind: 'erc20'; index: number }> = [];
    const ownerHex = this.resolveErc20BalanceAddress(address);

    requests.forEach((request, index) => {
      if (request.assetType === 'Native') {
        nativeIndexes.push(index);
        return;
      }

      rpcRequests.push({
        method: 'cfx_call',
        params: [
          {
            to: request.contractAddress,
            data: iface777.encodeFunctionData('balanceOf', [ownerHex]) as Hex,
          },
          'latest_state',
        ],
      });
      responseBindings.push({ kind: 'erc20', index });
    });

    if (nativeIndexes.length > 0) {
      rpcRequests.unshift({ method: 'cfx_getBalance', params: [address, 'latest_state'] });
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
              data: iface777.encodeFunctionData('balanceOf', [ownerHex]) as Hex,
            });
          } catch {
            return null;
          }
        }),
      );
    }
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

  private async getNonceOrProvided(address: Address, override?: number): Promise<number> {
    if (typeof override === 'number') return override;
    return this.getNonce(address);
  }

  private async getEpochHeightOrLatest(override?: number): Promise<number> {
    if (typeof override === 'number') return override;
    const { sdkRpc } = this.getConfluxClients();
    const epoch = await sdkRpc.getEpochNumber('latest_state');
    return this.toNumber(epoch);
  }

  private resolveErc20BalanceAddress(address: Address): string {
    if (address.startsWith('cfx') || address.startsWith('net')) {
      return convertBase32ToHex(address as Base32Address);
    }
    return address;
  }

  private async populateUnsignedTransaction(tx: ConfluxUnsignedTransaction): Promise<ConfluxUnsignedTransaction> {
    const draft = tx.payload;
    const nonce = await this.getNonceOrProvided(draft.from, draft.nonce);
    const epochHeight = await this.getEpochHeightOrLatest(draft.epochHeight);
    const estimate = await this.estimateFee({
      ...tx,
      payload: {
        ...draft,
        nonce,
        epochHeight,
      },
    });
    const usesGasPriceAs1559Fee = draft.type === 2 && draft.gasPrice !== undefined && draft.maxFeePerGas === undefined && draft.maxPriorityFeePerGas === undefined;
    const feeFields = this.canonicalizeFeeFields(
      usesGasPriceAs1559Fee
        ? {
            // Keep js-conflux-sdk's type=2 + gasPrice shorthand intact instead of mixing it with estimated 1559 caps.
            type: draft.type,
            gasPrice: draft.gasPrice,
          }
        : {
            type: draft.type,
            gasPrice: draft.gasPrice ?? estimate.gasPrice,
            maxFeePerGas: draft.maxFeePerGas ?? estimate.maxFeePerGas,
            maxPriorityFeePerGas: draft.maxPriorityFeePerGas ?? estimate.maxPriorityFeePerGas,
          },
      {
        networkSupports1559: estimate.maxFeePerGas != null && estimate.maxPriorityFeePerGas != null,
      },
    );

    return {
      ...tx,
      payload: {
        ...draft,
        gasLimit: draft.gasLimit ?? estimate.gasLimit,
        ...feeFields,
        nonce,
        epochHeight,
        storageLimit: draft.storageLimit ?? estimate.storageLimit,
      },
    };
  }

  private toUnsignedTransaction(payload: ConfluxUnsignedTransactionPayload): ConfluxUnsignedTransaction {
    return {
      chainType: this.networkType,
      payload,
    };
  }

  private async estimateLegacyFee(payload: ConfluxUnsignedTransactionPayload, gasUsed: bigint, storageCollateralized: bigint): Promise<ConfluxFeeEstimate> {
    const { sdkRpc } = this.getConfluxClients();
    const gasPrice = payload.gasPrice ? this.toBigInt(payload.gasPrice) : await sdkRpc.getGasPrice();

    return this.toFeeEstimate(payload, gasUsed, storageCollateralized, { gasPrice });
  }

  private async estimateEip1559Fee(
    payload: ConfluxUnsignedTransactionPayload,
    gasUsed: bigint,
    storageCollateralized: bigint,
    baseFeePerGas?: bigint,
  ): Promise<ConfluxFeeEstimate> {
    const { sdkRpc } = this.getConfluxClients();
    const maxPriorityFeePerGas = payload.maxPriorityFeePerGas ? this.toBigInt(payload.maxPriorityFeePerGas) : await sdkRpc.maxPriorityFeePerGas();
    // Keep Core Space 1559 defaults aligned with js-conflux-sdk populateTransaction.
    const maxFeePerGas = payload.maxFeePerGas ? this.toBigInt(payload.maxFeePerGas) : maxPriorityFeePerGas + (baseFeePerGas ?? 0n) * 2n;

    this.assertMaxFeePerGasNotLowerThanPriorityFee({ maxFeePerGas, maxPriorityFeePerGas });

    return this.toFeeEstimate(payload, gasUsed, storageCollateralized, {
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
  }

  private toFeeEstimate(
    payload: ConfluxUnsignedTransactionPayload,
    gasUsed: bigint,
    storageCollateralized: bigint,
    feeFields: {
      gasPrice?: bigint;
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
    },
  ): ConfluxFeeEstimate {
    const gasLimit = payload.gasLimit ? BigInt(payload.gasLimit) : gasUsed;
    const storageLimit = payload.storageLimit ? BigInt(payload.storageLimit) : storageCollateralized;

    return {
      chainType: this.networkType,
      gasLimit: this.formatHex(gasLimit),
      gasPrice: feeFields.gasPrice !== undefined ? this.formatHex(feeFields.gasPrice) : undefined,
      maxFeePerGas: feeFields.maxFeePerGas !== undefined ? this.formatHex(feeFields.maxFeePerGas) : undefined,
      maxPriorityFeePerGas: feeFields.maxPriorityFeePerGas !== undefined ? this.formatHex(feeFields.maxPriorityFeePerGas) : undefined,
      storageLimit: this.formatHex(storageLimit),
    };
  }

  private inferTypeFromFeeFields(input: { gasPrice?: string; maxFeePerGas?: string; maxPriorityFeePerGas?: string }): 0 | 2 | undefined {
    if (input.maxFeePerGas || input.maxPriorityFeePerGas) return 2;
    if (input.gasPrice) return 0;
    return undefined;
  }

  private canonicalizePayload(
    payload: ConfluxUnsignedTransaction['payload'],
    options: { networkSupports1559?: boolean } = {},
  ): ConfluxUnsignedTransaction['payload'] {
    const feeFields = this.canonicalizeFeeFields(
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
      ...feeFields,
    };
  }

  private canonicalizeFeeFields(
    input: {
      type?: number;
      gasPrice?: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    },
    options: { networkSupports1559?: boolean } = {},
  ) {
    const type = input.type ?? this.inferTypeFromFeeFields(input);
    const hasLegacyFee = input.gasPrice !== undefined;
    const has1559Fee = input.maxFeePerGas !== undefined || input.maxPriorityFeePerGas !== undefined;
    const isLegacyType = type === 0 || type === 1;
    const isEip1559Type = type === 2;

    if (hasLegacyFee && has1559Fee) {
      throw new Error('gasPrice cannot be set with maxFeePerGas or maxPriorityFeePerGas.');
    }

    if (isEip1559Type || (!isLegacyType && (has1559Fee || (!hasLegacyFee && options.networkSupports1559)))) {
      const maxFeePerGas = input.maxFeePerGas ?? (isEip1559Type ? input.gasPrice : undefined);
      const maxPriorityFeePerGas = input.maxPriorityFeePerGas ?? (isEip1559Type ? input.gasPrice : undefined);

      this.assertMaxFeePerGasNotLowerThanPriorityFee({
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      return {
        type: 2 as const,
        gasPrice: undefined,
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
    }

    if (isLegacyType || hasLegacyFee) {
      return {
        type: type ?? (hasLegacyFee ? 0 : undefined),
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

  private buildEstimateRequest(payload: ConfluxUnsignedTransactionPayload): ConfluxEstimateRequest {
    const request: ConfluxEstimateRequest = {
      from: payload.from,
      data: payload.data,
      value: payload.value,
    };

    if (payload.to !== undefined) request.to = payload.to;
    if (payload.gasLimit !== undefined) request.gas = payload.gasLimit;
    if (payload.nonce !== undefined) request.nonce = payload.nonce;
    if (payload.storageLimit !== undefined) request.storageLimit = payload.storageLimit;
    if (payload.type !== undefined) request.type = payload.type;
    if (payload.gasPrice !== undefined) request.gasPrice = payload.gasPrice;
    if (payload.maxFeePerGas !== undefined) request.maxFeePerGas = payload.maxFeePerGas;
    if (payload.maxPriorityFeePerGas !== undefined) request.maxPriorityFeePerGas = payload.maxPriorityFeePerGas;

    return request;
  }

  private async getBaseFeePerGas(epochHeight?: number): Promise<bigint | undefined> {
    const { sdkRpc } = this.getConfluxClients();
    const block = await sdkRpc.getBlockByEpochNumber(epochHeight ?? 'latest_state', false);
    return block?.baseFeePerGas !== undefined && block.baseFeePerGas !== null ? this.toBigInt(block.baseFeePerGas) : undefined;
  }

  private assertMaxFeePerGasNotLowerThanPriorityFee(input: { maxFeePerGas?: string | bigint; maxPriorityFeePerGas?: string | bigint }) {
    if (!input.maxFeePerGas || !input.maxPriorityFeePerGas) return;
    if (this.toBigInt(input.maxFeePerGas) < this.toBigInt(input.maxPriorityFeePerGas)) {
      throw new Error('maxFeePerGas cannot be lower than maxPriorityFeePerGas.');
    }
  }

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
