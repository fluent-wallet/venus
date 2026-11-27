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
import { addHexPrefix } from '@core/utils/base';
import { NetworkType } from '@core/utils/consts';
import type { Address as Base32Address } from 'cive';
import { signMessage as signConfluxMessage, signTransaction as signConfluxTransaction } from 'cive/accounts';
import { base32AddressToHex, decodeBase32Address, isAddress, keccak256, publicKeyToAddress, verifyMessage as verifyConfluxMessage } from 'cive/utils';
import type { Hex } from 'ox/Hex';
import type { EndpointManager } from './EndpointManager';
import { buildTransactionPayload } from './utils/transactionBuilder';

export interface ConfluxChainProviderOptions {
  chainId: string;
  netId: number;

  networkId: string; // WatermelonDB Network.id
  endpointManager: EndpointManager;
}

export class ConfluxChainProvider implements IChainProvider<ConfluxUnsignedTransaction, ConfluxFeeEstimate> {
  readonly chainId: string;
  readonly networkType = NetworkType.Conflux;
  readonly netId: number;

  readonly rpc: IChainRpc;

  constructor({ chainId, netId, networkId, endpointManager }: ConfluxChainProviderOptions) {
    this.chainId = chainId;
    this.netId = netId;

    this.rpc = new DynamicHttpJsonRpcClient({ endpointManager, networkId });
  }

  deriveAddress(publicKey: Hex): string {
    return publicKeyToAddress({ publicKey, networkId: this.netId });
  }

  validateAddress(address: Address): boolean {
    try {
      return decodeBase32Address({ address: address as Base32Address }).networkId === this.netId;
    } catch {
      return false;
    }
  }

  async prepareUnsignedTransaction(tx: ConfluxUnsignedTransaction): Promise<ConfluxUnsignedTransaction> {
    return this.finalizePreparedTransaction(tx);
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
    const { gasUsed, storageCollateralized } = await this.rpc.request<{ gasUsed: Hex; storageCollateralized: Hex }>('cfx_estimateGasAndCollateral', [
      {
        from: payload.from,
        to: payload.to,
        data: payload.data,
        value: payload.value,
      },
      'latest_state',
    ]);

    const gasPrice = payload.gasPrice ? BigInt(payload.gasPrice) : BigInt(await this.rpc.request<Hex>('cfx_gasPrice', []));

    return this.toFeeEstimate(payload, BigInt(gasUsed), BigInt(storageCollateralized), gasPrice);
  }
  async signTransaction(tx: ConfluxUnsignedTransaction, signer: ISigner): Promise<SignedTransaction<NetworkType.Conflux>> {
    if (signer.type === 'software') {
      return this.signWithSoftware(tx, signer);
    } else {
      return this.signWithHardware(tx, signer);
    }
  }

  private async signWithSoftware(tx: ConfluxUnsignedTransaction, signer: ISoftwareSigner): Promise<SignedTransaction<NetworkType.Conflux>> {
    const { payload } = tx;
    const { gasLimit, gasPrice, storageLimit, nonce, epochHeight } = payload;
    if (gasLimit == null || gasPrice == null || storageLimit == null || nonce == null || epochHeight == null) {
      throw new Error('Conflux transaction must be prepared before signing.');
    }

    const rawTransaction = await signConfluxTransaction({
      privateKey: addHexPrefix(signer.getPrivateKey()) as Hex,
      transaction: {
        chainId: Number(payload.chainId),
        nonce,
        epochHeight: BigInt(epochHeight),
        gas: BigInt(gasLimit),
        gasPrice: BigInt(gasPrice),
        storageLimit: BigInt(storageLimit),
        to: payload.to as Base32Address | undefined,
        value: BigInt(payload.value),
        data: payload.data,
      },
    });

    return {
      chainType: tx.chainType,
      rawTransaction,
      hash: keccak256(rawTransaction),
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
    return this.rpc.request<Hash>('cfx_sendRawTransaction', [signedTx.rawTransaction]);
  }
  async getBalance(address: Address): Promise<Hex> {
    return this.rpc.request<Hex>('cfx_getBalance', [address, 'latest_state']);
  }
  async getNonce(address: Address): Promise<number> {
    const result = await this.rpc.request<Hex>('cfx_getNextNonce', [address, 'latest_state']);
    return Number(BigInt(result));
  }

  async call(params: ChainCallParams): Promise<Hex> {
    const { to, data } = params;
    return this.rpc.request<Hex>('cfx_call', [{ to, data }, 'latest_state']);
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
      const isHexBytes = message.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(message);
      return signConfluxMessage({
        privateKey: addHexPrefix(signer.getPrivateKey()) as Hex,
        message: isHexBytes ? { raw: message as Hex } : message,
      });
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

  async verifyMessage(message: string, signature: string, address: Address): Promise<boolean> {
    try {
      const decoded = decodeBase32Address({ address: address as Base32Address });
      if (decoded.networkId !== this.netId) return false;
      const isHexBytes = message.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(message);

      return await verifyConfluxMessage({
        address: address as Base32Address,
        message: isHexBytes ? { raw: message as Hex } : message,
        signature: signature as Hex,
      });
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
    const epoch = await this.rpc.request<Hex>('cfx_epochNumber', ['latest_state']);
    return Number(BigInt(epoch));
  }

  private resolveErc20BalanceAddress(address: Address): string {
    return isAddress(address) ? base32AddressToHex({ address }) : address;
  }

  private async finalizePreparedTransaction(tx: ConfluxUnsignedTransaction): Promise<ConfluxUnsignedTransaction> {
    const estimate = await this.estimateFee(tx);
    const nonce = await this.resolveNonce(tx.payload.from, tx.payload.nonce);
    const epochHeight = await this.resolveEpochHeight(tx.payload.epochHeight);

    return {
      ...tx,
      payload: {
        ...tx.payload,
        gasLimit: tx.payload.gasLimit ?? estimate.gasLimit,
        gasPrice: tx.payload.gasPrice ?? estimate.gasPrice,
        nonce,
        epochHeight,
        storageLimit: tx.payload.storageLimit ?? estimate.storageLimit,
      },
    };
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
}
