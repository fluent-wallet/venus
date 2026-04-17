import { ChainRegistry } from '@core/chains';
import { iface721, iface777, iface1155 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import { type Network, NetworkType } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import {
  TxStatus as DbTxStatus,
  EXECUTED_TX_STATUSES,
  ExecutedStatus,
  FINISHED_IN_ACTIVITY_TX_STATUSES,
  PENDING_COUNT_STATUSES,
  PENDING_TX_STATUSES,
  TxSource,
} from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import { VaultType } from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import {
  CHAIN_PROVIDER_NOT_FOUND,
  CoreError,
  TX_ESTIMATE_FAILED,
  TX_INVALID_PARAMS,
  TX_SIGN_ADDRESS_MISMATCH,
  TX_SIGN_UNSUPPORTED_NETWORK,
} from '@core/errors';
import type { RuntimeConfig } from '@core/runtime/types';
import { AddressValidationService } from '@core/services/address/AddressValidationService';
import {
  ASSET_TYPE,
  AssetType,
  type AssetTypeValue,
  type ChainType,
  type EvmChainProviderLike,
  type EvmUnsignedTransaction,
  type FeeEstimate,
  type Hex,
  type IChainProvider,
  type SpeedUpAction,
  type TransactionStateSnapshot,
  TX_EXECUTION_STATUS,
  TX_LIFECYCLE_STATUS,
} from '@core/types';
import { Networks } from '@core/utils/consts';
import { type ParseTxDataReturnType, parseTxData } from '@core/utils/txData';
import { Interface } from '@ethersproject/abi';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import * as OxHex from 'ox/Hex';
import * as OxValue from 'ox/Value';
import type { EvmRpcTransactionRequest } from './dappTypes';
import { createConfluxTransactionHandlers } from './handlers/conflux';
import { createEvmTransactionHandlers } from './handlers/evm';
import { TransactionExecutionService } from './handlers/TransactionExecutionService';
import type { TransactionHandlerContext, TransactionHandlers } from './handlers/types';
import type {
  PrecheckTransferInput,
  PrecheckTransferResult,
  PreparedDappTransaction,
  PreparedReplacement,
  PreparedTransfer,
  PreparedTransferAsset,
  QuoteTransactionRequest,
  ReviewDappTransactionInput,
  ReviewDappTransactionResult,
  ReviewReplacementInput,
  ReviewReplacementResult,
  ReviewTransferInput,
  ReviewTransferResult,
  TransactionQuote,
} from './stagedTypes';
import type {
  GasPricingEstimate,
  IActivityTransaction,
  ITransaction,
  ITransactionDetail,
  LegacyLikeGasEstimate,
  RecentlyAddress,
  SendDappTransactionInput,
  SendERC20Input,
  SendTransactionInput,
  SpeedUpTxContext,
  SpeedUpTxInput,
  TransactionAssetSnapshot,
  TransactionDisplaySnapshot,
  TransactionExtraSnapshot,
  TransactionFilter,
  TransactionNetworkSnapshot,
  TransactionPayloadSnapshot,
  TransactionReceiptSnapshot,
  TransactionSource,
} from './types';

const SERVICE_PENDING_ACTIVITY_TX_STATUSES = [...PENDING_TX_STATUSES, DbTxStatus.TEMP_REPLACED];
const SERVICE_FINISHED_ACTIVITY_TX_STATUSES = FINISHED_IN_ACTIVITY_TX_STATUSES.filter((status) => status !== DbTxStatus.TEMP_REPLACED);
const SERVICE_PENDING_ACTIVITY_TX_STATUS_SET = new Set<DbTxStatus>(SERVICE_PENDING_ACTIVITY_TX_STATUSES);
const SERVICE_FINISHED_ACTIVITY_TX_STATUS_SET = new Set<DbTxStatus>(SERVICE_FINISHED_ACTIVITY_TX_STATUSES);
const CONFLUX_EIP1559_FEE_HISTORY_BLOCKS = '0x5' as Hex;
const CONFLUX_EIP1559_FEE_HISTORY_PERCENTILES = [10, 20, 30] as const;

type TxLike = {
  from?: string;
  to?: string;
  value?: string;
  data?: string;
};

const GAS_LEVELS = ['low', 'medium', 'high'] as const;
type GasLevel = (typeof GAS_LEVELS)[number];

const CONFLUX_EIP1559_BASE_FEE_MULTIPLIERS: Record<GasLevel, bigint> = {
  low: 90n,
  medium: 100n,
  high: 120n,
};

@injectable()
export class TransactionService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(CORE_IDENTIFIERS.CONFIG)
  @optional()
  private readonly config?: RuntimeConfig;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  @inject(AddressValidationService)
  private readonly addressValidationService!: AddressValidationService;

  @inject(TransactionExecutionService)
  private readonly transactionExecutionService!: TransactionExecutionService;

  async isPendingTxsFull(params: { addressId: string }): Promise<boolean> {
    const { addressId } = params;
    if (!addressId) return false;

    const limit = this.getPendingCountLimit();

    const count = await this.database
      .get<Tx>(TableName.Tx)
      .query(Q.where('address_id', addressId), Q.where('is_temp_replaced', Q.notEq(true)), Q.where('status', Q.oneOf(PENDING_COUNT_STATUSES)))
      .fetchCount();

    return count >= limit;
  }

  async estimateGasPricing(params: { addressId: string; tx: TxLike; withNonce?: boolean }): Promise<GasPricingEstimate> {
    const { addressId, tx, withNonce = true } = params;

    const address = await this.findAddress(addressId);
    const network = await this.getNetwork(address);
    const chainProvider = this.getChainProvider(network);

    const from = tx.from ?? (await address.getValue());
    const to = tx.to;
    const data = tx.data ?? '0x';
    const value = tx.value ?? '0x0';

    const gasBuffer = network.gasBuffer > 0 ? network.gasBuffer : 1;
    const [nonce, gasPrice] = await Promise.all([withNonce ? chainProvider.getNonce(from) : Promise.resolve(0), this.getGasPrice({ chainProvider, network })]);

    const minGasPriceWei = this.getMinGasPrice(network);

    if (network.networkType === NetworkType.Ethereum) {
      const supports1559 = await this.is1559Supported({ chainProvider, network });
      const isContract = to
        ? await this.addressValidationService.isContractAddress({ networkType: network.networkType, chainId: network.chainId, addressValue: to })
        : true;
      const isSendNativeToken = (!!to && !isContract) || !data || data === '0x';

      const gasLimit = isSendNativeToken
        ? this.applyGasBuffer(21_000n, gasBuffer)
        : await this.estimateEvmGasLimit({ chainProvider, from, to, data, value, gasBuffer });

      return {
        gasLimit,
        gasPrice,
        constraints: { minGasPriceWei },
        pricing: supports1559
          ? { kind: 'eip1559', levels: this.buildEip1559Levels({ gasPrice, gasLimit, network }) }
          : { kind: 'legacy', levels: this.buildLegacyLevels({ gasPrice, gasLimit, network }) },
        nonce,
      };
    }

    if (network.networkType === NetworkType.Conflux) {
      const isContract = to
        ? await this.addressValidationService.isContractAddress({ networkType: network.networkType, chainId: network.chainId, addressValue: to })
        : true;
      const isSendNativeToken = (!!to && !isContract) || !data || data === '0x';
      const buildResult = async (gasLimit: Hex, storageLimit: Hex): Promise<GasPricingEstimate> => ({
        gasLimit,
        storageLimit,
        gasPrice,
        constraints: { minGasPriceWei },
        pricing: await this.buildConfluxPricing({ chainProvider, gasPrice, gasLimit, network }),
        nonce,
      });

      if (isSendNativeToken) {
        return buildResult(this.applyGasBuffer(21_000n, gasBuffer), '0x0');
      }

      const { gasLimit, storageLimit } = await this.estimateCfxGasAndCollateral({ chainProvider, from, to, data, value, gasBuffer });

      return buildResult(gasLimit, storageLimit);
    }

    throw new Error(`estimateGasPricing: unsupported networkType: ${String(network.networkType)}`);
  }

  async quoteTransaction(input: QuoteTransactionRequest): Promise<TransactionQuote> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);
    const from = await address.getValue();

    return this.getTransactionHandlers(network).quoteTransaction({
      from,
      to: input.to,
      value: input.value,
      data: input.data,
      withNonce: input.withNonce,
    });
  }

  async precheckTransfer(input: PrecheckTransferInput): Promise<PrecheckTransferResult> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    return this.getTransactionHandlers(network).precheckTransfer({
      address,
      request: input,
    });
  }

  async reviewTransfer(input: ReviewTransferInput): Promise<ReviewTransferResult> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    return this.getTransactionHandlers(network).reviewTransfer({
      address,
      request: input,
    });
  }

  async executeTransfer(prepared: PreparedTransfer, options: { signal?: AbortSignal } = {}): Promise<ITransaction> {
    const address = await this.findAddress(prepared.addressId);
    const network = await this.getNetwork(address);
    this.assertPreparedNetworkType(prepared.networkType, network.networkType, prepared.preparedKind);

    const unsignedTx = await this.getTransactionHandlers(network).buildTransferUnsignedTransaction(prepared);
    const tx = await this.transactionExecutionService.executeSelfTransaction({
      address,
      network,
      unsignedTx,
      assetType: this.toLegacyAssetType(prepared.asset),
      contractAddress: prepared.asset.contractAddress,
      signal: options.signal,
    });

    return this.toInterface(tx);
  }

  async reviewReplacement(input: ReviewReplacementInput): Promise<ReviewReplacementResult> {
    const originTx = await this.findTxOrThrow(input.txId);
    const address = await originTx.address.fetch();
    const network = await this.getNetwork(address);

    return this.getTransactionHandlers(network).reviewReplacement({
      originTx,
      request: input,
    });
  }

  async executeReplacement(prepared: PreparedReplacement, options: { signal?: AbortSignal } = {}): Promise<ITransaction> {
    const address = await this.findAddress(prepared.addressId);
    const network = await this.getNetwork(address);
    const originTx = await this.findTxOrThrow(prepared.originTxId);
    const originAddress = await originTx.address.fetch();

    this.assertPreparedNetworkType(prepared.networkType, network.networkType, prepared.preparedKind);

    if (originAddress.id !== address.id) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Prepared replacement address does not match origin transaction address.',
        context: {
          preparedAddressId: address.id,
          originAddressId: originAddress.id,
          originTxId: originTx.id,
        },
      });
    }

    const unsignedTx = await this.getTransactionHandlers(network).buildReplacementUnsignedTransaction(prepared);
    const tx = await this.transactionExecutionService.executeReplacementTransaction({
      originTx,
      address,
      network,
      unsignedTx,
      sendAction: prepared.action,
      hideOriginAsTempReplaced: true,
      signal: options.signal,
    });

    return this.toInterface(tx);
  }

  async reviewDappTransaction(input: ReviewDappTransactionInput): Promise<ReviewDappTransactionResult> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    return this.getTransactionHandlers(network).reviewDappTransaction({
      address,
      request: input,
    });
  }

  async executeDappTransaction(prepared: PreparedDappTransaction, options: { signal?: AbortSignal } = {}): Promise<ITransaction> {
    const address = await this.findAddress(prepared.addressId);
    const network = await this.getNetwork(address);

    this.assertPreparedNetworkType(prepared.networkType, network.networkType, prepared.preparedKind);

    const unsignedTx = await this.getTransactionHandlers(network).buildDappUnsignedTransaction(prepared);
    const tx = await this.transactionExecutionService.executeDappTransaction({
      address,
      network,
      unsignedTx,
      app: prepared.app ?? null,
      signal: options.signal,
    });

    return this.toInterface(tx);
  }

  async decodeContractData(params: { addressId: string; to?: string | null; data?: string | null }): Promise<ParseTxDataReturnType> {
    const parsed = parseTxData({ data: params.data, to: params.to });
    if (!params.data || parsed.functionName !== 'unknown' || !params.to) {
      return parsed;
    }

    const address = await this.findAddress(params.addressId);
    const network = await address.network.fetch();
    const networkConfig = Object.values(Networks).find((item) => item.netId === network.netId);
    const scanOpenApi = networkConfig && 'scanOpenAPI' in networkConfig ? networkConfig.scanOpenAPI : undefined;
    if (!scanOpenApi) {
      return parsed;
    }

    try {
      const response = await fetch(`${scanOpenApi}/util/decode/method/raw?contracts=${params.to}&inputs=${params.data}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }).then((res) => res.json());

      if (!response?.result || !Array.isArray(response.result) || response.result.length === 0) {
        return parsed;
      }

      const responseData = response.result[0];
      if (!responseData?.abi) {
        return parsed;
      }

      const abi = JSON.parse(responseData.abi);
      const methodId = params.data.slice(0, 10);
      const iface = new Interface([abi]);
      const fn = iface.getFunction(methodId);
      if (!fn) {
        return parsed;
      }

      iface.decodeFunctionData(fn, params.data);

      return {
        functionName: fn.name,
        readableABI: fn.format(),
      };
    } catch {
      return parsed;
    }
  }

  /**
   * @deprecated Legacy UI adapter. Prefer `estimateGasPricing`.
   */
  async estimateLegacyGasForUi(params: { addressId: string; tx: TxLike; withNonce?: boolean }): Promise<LegacyLikeGasEstimate> {
    const res = await this.estimateGasPricing(params);
    const { gasLimit, storageLimit, gasPrice, nonce, pricing } = res;

    if (pricing.kind === 'legacy') {
      const levels = pricing.levels;
      return {
        gasLimit,
        storageLimit,
        gasPrice,
        estimate: Object.fromEntries(
          GAS_LEVELS.map((level) => [level, { suggestedGasPrice: levels[level].gasPrice, gasCost: levels[level].gasCost }]),
        ) as LegacyLikeGasEstimate['estimate'],
        nonce,
      };
    }

    const levels = pricing.levels;
    return {
      gasLimit,
      storageLimit,
      gasPrice,
      estimateOf1559: Object.fromEntries(
        GAS_LEVELS.map((level) => [
          level,
          {
            suggestedMaxFeePerGas: levels[level].maxFeePerGas,
            suggestedMaxPriorityFeePerGas: levels[level].maxPriorityFeePerGas,
            gasCost: levels[level].gasCost,
          },
        ]),
      ) as LegacyLikeGasEstimate['estimateOf1559'],
      nonce,
    };
  }

  getMinGasPriceWei(params: { chainId: string; networkType: ChainType }): Hex {
    return this.getMinGasPrice(params);
  }

  // send native token
  async sendNative(input: SendTransactionInput): Promise<ITransaction> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);
    const { intent, override } = this.adaptLegacyTransferInput(input, network.networkType);

    const review = await this.reviewTransfer({
      addressId: input.addressId,
      intent,
      override,
    });

    if (!review.canSubmit || !review.prepared) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: review.error?.message ?? 'Failed to build staged transfer.',
        context: {
          addressId: input.addressId,
          networkType: network.networkType,
          to: input.to,
          assetType: input.assetType,
        },
      });
    }

    return this.executeTransfer(review.prepared, {
      signal: input.signal,
    });
  }
  // send erc20 token
  async sendERC20(input: SendERC20Input): Promise<ITransaction> {
    return this.sendNative({
      addressId: input.addressId,
      to: input.to,
      amount: input.amount,
      assetType: AssetType.ERC20,
      assetDecimals: input.assetDecimals,
      contractAddress: input.contractAddress,
      gasLimit: input.gasLimit,
      gasPrice: input.gasPrice,
      maxFeePerGas: input.maxFeePerGas,
      maxPriorityFeePerGas: input.maxPriorityFeePerGas,
      nonce: input.nonce,
      storageLimit: input.storageLimit,
      signal: input.signal,
    });
  }

  async estimateDappTransaction(input: { addressId: string; request: EvmRpcTransactionRequest; signal?: AbortSignal }): Promise<FeeEstimate> {
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    if (network.networkType !== NetworkType.Ethereum) {
      throw new CoreError({
        code: TX_SIGN_UNSUPPORTED_NETWORK,
        message: 'TransactionService.estimateDappTransaction is only supported for Ethereum networks.',
        context: { networkType: network.networkType, chainId: network.chainId },
      });
    }

    const currentAddressValue = (await address.getValue()).toLowerCase();
    if (input.request.from.toLowerCase() !== currentAddressValue) {
      throw new CoreError({
        code: TX_SIGN_ADDRESS_MISMATCH,
        message: 'TransactionService.estimateDappTransaction address mismatch.',
        context: { expectedFrom: currentAddressValue, from: input.request.from },
      });
    }

    const chainProvider = this.getChainProvider<EvmChainProviderLike>(network);
    const unsignedTx = this.buildEvmUnsignedTransactionDraft({ chainId: network.chainId, request: input.request });

    try {
      return await chainProvider.estimateFee(unsignedTx);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_ESTIMATE_FAILED,
        message: 'Failed to estimate dApp transaction fee.',
        cause: error,
        context: { chainId: network.chainId },
      });
    }
  }

  async sendDappTransaction(input: SendDappTransactionInput): Promise<ITransaction> {
    const review = await this.reviewDappTransaction({
      addressId: input.addressId,
      request: input.request,
      app: input.app ?? null,
    });

    if (!review.canSubmit || !review.prepared) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: review.error?.message ?? 'Failed to build staged dApp transaction.',
        context: {
          addressId: input.addressId,
          from: input.request.from,
          to: input.request.to,
        },
      });
    }

    return this.executeDappTransaction(review.prepared, {
      signal: input.signal,
    });
  }

  async getSpeedUpTxContext(txId: string): Promise<SpeedUpTxContext | null> {
    const tx = await this.findTxOrNull(txId);
    if (!tx) return null;

    const [address, payload, extra] = await Promise.all([tx.address.fetch(), tx.txPayload.fetch(), tx.txExtra.fetch()]);
    const [network, account] = await Promise.all([address.network.fetch(), address.account.fetch()]);
    if (!network) return null;
    const state = this.buildState(tx.status, tx.executedStatus ?? null);

    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();

    let assetType: AssetType | null = null;
    try {
      const asset = await tx.asset.fetch();
      assetType = (asset?.type as unknown as AssetType) ?? null;
    } catch {
      assetType = null;
    }

    return {
      txId: tx.id,
      addressId: address.id,
      accountId: account.id,
      networkId: network.id,
      networkType: network.networkType,
      isHardwareWallet: vault.type === VaultType.BSIM,
      state,
      sendAction: extra.sendAction ?? null,
      assetType,
      payload: {
        from: (await this.resolvePayloadFrom(address, payload)) ?? '',
        to: payload.to ?? '',
        value: payload.value ?? '0x0',
        data: (payload.data ?? '0x') as Hex,
        chainId: payload.chainId ?? network.chainId,
        nonce: payload.nonce ?? 0,
        gasPrice: payload.gasPrice,
        maxFeePerGas: payload.maxFeePerGas,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas,
        gasLimit: payload.gasLimit,
        storageLimit: payload.storageLimit,
        epochHeight: payload.epochHeight,
      },
    };
  }

  async speedUpTx(input: SpeedUpTxInput): Promise<ITransaction> {
    const { action, override } = this.adaptLegacyReplacementInput(input);

    const review = await this.reviewReplacement({
      txId: input.txId,
      action,
      override,
    });

    if (!review.canSubmit || !review.prepared) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: review.error?.message ?? 'Failed to build staged replacement.',
        context: {
          txId: input.txId,
          action: input.action,
        },
      });
    }

    return this.executeReplacement(review.prepared, {
      signal: input.signal,
    });
  }

  private async findAddress(addressId: string): Promise<Address> {
    try {
      return await this.database.get<Address>(TableName.Address).find(addressId);
    } catch {
      throw new Error(`[TransactionService] Address ${addressId} not found in database.`);
    }
  }

  private async getNetwork(address: Address): Promise<Network> {
    const network = await address.network.fetch();
    if (!network) {
      throw new Error('[TransactionService] Address has no associated network.');
    }
    return network;
  }

  private getChainProvider<TProvider extends IChainProvider = IChainProvider>(network: Network): TProvider {
    const provider = this.chainRegistry.get<TProvider>(network.chainId, network.networkType);
    if (!provider) {
      throw new CoreError({
        code: CHAIN_PROVIDER_NOT_FOUND,
        message: 'Chain provider is not registered in ChainRegistry.',
        context: { chainId: network.chainId, networkType: network.networkType },
      });
    }
    return provider;
  }

  private getTransactionHandlers(network: Network): TransactionHandlers {
    const context: TransactionHandlerContext = {
      network,
      chainProvider: this.getChainProvider(network),
      config: this.config,
      addressValidationService: this.addressValidationService,
    };

    switch (network.networkType) {
      case NetworkType.Ethereum:
        return createEvmTransactionHandlers(context);
      case NetworkType.Conflux:
        return createConfluxTransactionHandlers(context);
      default:
        throw new CoreError({
          code: TX_SIGN_UNSUPPORTED_NETWORK,
          message: 'Transaction handlers are not available for this network.',
          context: { networkType: network.networkType, chainId: network.chainId },
        });
    }
  }

  private adaptLegacyTransferInput(
    input: SendTransactionInput,
    networkType: NetworkType,
  ): {
    intent: ReviewTransferInput['intent'];
    override?: ReviewTransferInput['override'];
  } {
    let intent: ReviewTransferInput['intent'];

    switch (input.assetType) {
      case AssetType.Native:
        intent = {
          recipient: input.to,
          asset: {
            kind: 'native',
            standard: 'native',
            decimals: input.assetDecimals,
          },
          amount: { kind: 'exact', amount: input.amount },
          data: input.data,
        };
        break;
      case AssetType.ERC20:
        intent = {
          recipient: input.to,
          asset: {
            kind: 'fungible',
            standard: networkType === NetworkType.Conflux ? 'crc20' : 'erc20',
            contractAddress: input.contractAddress!,
            decimals: input.assetDecimals,
          },
          amount: { kind: 'exact', amount: input.amount },
        };
        break;
      case AssetType.ERC721:
        if (networkType === NetworkType.Conflux) {
          throw new CoreError({
            code: TX_INVALID_PARAMS,
            message: 'Unsupported assetType for staged Conflux send.',
            context: { assetType: input.assetType },
          });
        }

        intent = {
          recipient: input.to,
          asset: {
            kind: 'nft721',
            standard: 'erc721',
            contractAddress: input.contractAddress!,
            tokenId: input.nftTokenId!,
            decimals: 0,
          },
          amount: { kind: 'exact', amount: '1' },
        };
        break;
      case AssetType.ERC1155:
        if (networkType === NetworkType.Conflux) {
          throw new CoreError({
            code: TX_INVALID_PARAMS,
            message: 'Unsupported assetType for staged Conflux send.',
            context: { assetType: input.assetType },
          });
        }

        intent = {
          recipient: input.to,
          asset: {
            kind: 'nft1155',
            standard: 'erc1155',
            contractAddress: input.contractAddress!,
            tokenId: input.nftTokenId!,
            decimals: 0,
          },
          amount: { kind: 'exact', amount: input.amount },
        };
        break;
      default:
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Unsupported assetType for staged send.',
          context: { assetType: input.assetType, networkType },
        });
    }

    const override: NonNullable<ReviewTransferInput['override']> = {};

    if (input.gasLimit) {
      override.gasLimit = input.gasLimit;
    }

    if (input.storageLimit) {
      override.storageLimit = input.storageLimit;
    }

    if (input.nonce != null) {
      override.nonce = input.nonce;
    }

    if (input.gasPrice != null) {
      override.feeSelection = {
        kind: 'custom',
        fee: { gasPrice: input.gasPrice },
      };
    } else if (input.maxFeePerGas != null && input.maxPriorityFeePerGas != null) {
      override.feeSelection = {
        kind: 'custom',
        fee: {
          maxFeePerGas: input.maxFeePerGas,
          maxPriorityFeePerGas: input.maxPriorityFeePerGas,
        },
      };
    }

    return {
      intent,
      override: Object.keys(override).length > 0 ? override : undefined,
    };
  }

  private adaptLegacyReplacementInput(input: SpeedUpTxInput): {
    action: ReviewReplacementInput['action'];
    override: NonNullable<ReviewReplacementInput['override']>;
  } {
    const override: NonNullable<ReviewReplacementInput['override']> = {
      nonce: input.nonce,
    };

    if (input.advanceOverrides?.gasLimit) {
      override.gasLimit = input.advanceOverrides.gasLimit;
    }

    if (input.advanceOverrides?.storageLimit) {
      override.storageLimit = input.advanceOverrides.storageLimit;
    }

    if (typeof input.feeOverrides.gasPrice === 'string') {
      override.feeSelection = {
        kind: 'custom',
        fee: {
          gasPrice: input.feeOverrides.gasPrice,
        },
      };
    } else if (typeof input.feeOverrides.maxFeePerGas === 'string' && typeof input.feeOverrides.maxPriorityFeePerGas === 'string') {
      override.feeSelection = {
        kind: 'custom',
        fee: {
          maxFeePerGas: input.feeOverrides.maxFeePerGas,
          maxPriorityFeePerGas: input.feeOverrides.maxPriorityFeePerGas,
        },
      };
    } else {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Invalid replacement fee overrides.',
        context: {
          txId: input.txId,
          feeOverrides: input.feeOverrides,
        },
      });
    }

    return {
      action: input.action,
      override,
    };
  }

  private parseHexQuantityToNumber(value: string | undefined, field: string): number | undefined {
    if (!value) return undefined;

    const asBigInt = BigInt(value);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Invalid JSON-RPC params.',
        context: { reason: `${field} exceeds Number.MAX_SAFE_INTEGER.` },
      });
    }

    return Number(asBigInt);
  }

  private buildEvmUnsignedTransactionDraft(params: { chainId: string; request: EvmRpcTransactionRequest }): EvmUnsignedTransaction {
    const { chainId, request } = params;

    return {
      chainType: NetworkType.Ethereum,
      payload: {
        from: request.from,
        to: request.to,
        chainId,
        data: request.data ?? '0x',
        value: request.value ?? '0x0',
        gasLimit: request.gas,
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        nonce: this.parseHexQuantityToNumber(request.nonce, 'nonce'),
        type: this.parseHexQuantityToNumber(request.type, 'type'),
      },
    };
  }

  private mapLifecycleStatus(status: DbTxStatus): TransactionStateSnapshot['lifecycle'] {
    switch (status) {
      case DbTxStatus.REPLACED:
        return TX_LIFECYCLE_STATUS.Replaced;
      case DbTxStatus.TEMP_REPLACED:
        return TX_LIFECYCLE_STATUS.TempReplaced;
      case DbTxStatus.SEND_FAILED:
        return TX_LIFECYCLE_STATUS.SendFailed;
      case DbTxStatus.WAITTING:
        return TX_LIFECYCLE_STATUS.Waiting;
      case DbTxStatus.DISCARDED:
        return TX_LIFECYCLE_STATUS.Discarded;
      case DbTxStatus.PENDING:
        return TX_LIFECYCLE_STATUS.Pending;
      case DbTxStatus.EXECUTED:
        return TX_LIFECYCLE_STATUS.Executed;
      case DbTxStatus.CONFIRMED:
        return TX_LIFECYCLE_STATUS.Confirmed;
      case DbTxStatus.FINALIZED:
        return TX_LIFECYCLE_STATUS.Finalized;
    }

    throw new Error(`Unknown transaction lifecycle status: ${String(status)}`);
  }

  private mapExecutionStatus(executedStatus: ExecutedStatus | null = null): TransactionStateSnapshot['execution'] {
    if (executedStatus === ExecutedStatus.FAILED) {
      return TX_EXECUTION_STATUS.Failed;
    }

    if (executedStatus === ExecutedStatus.SUCCEEDED) {
      return TX_EXECUTION_STATUS.Succeeded;
    }

    return TX_EXECUTION_STATUS.Unknown;
  }

  private buildState(status: DbTxStatus, executedStatus: ExecutedStatus | null = null): TransactionStateSnapshot {
    return {
      lifecycle: this.mapLifecycleStatus(status),
      execution: this.mapExecutionStatus(executedStatus),
    };
  }

  // get transactions list by filters
  async listTransactions(filter: TransactionFilter): Promise<ITransaction[]> {
    const { addressId, status = 'all', limit } = filter;
    const query = this.createTxQuery(addressId, status);
    const txs = await query.fetch();
    const sliced = typeof limit === 'number' && limit >= 0 ? txs.slice(0, limit) : txs;
    return Promise.all(sliced.map((tx) => this.toInterface(tx)));
  }

  /**
   * Activity list adapter for UI.
   * Returns a stable plain snapshot and avoids WatermelonDB model exposure.
   */
  async listActivityTransactions(filter: TransactionFilter): Promise<IActivityTransaction[]> {
    const { addressId, status = 'all', limit } = filter;
    // Deduplicate against the full activity candidate set first so the same nonce cannot leak into both pending and finished partitions.
    const txs = await this.createTxQuery(addressId, 'all').fetch();
    const deduped = await this.uniqSortByNoncePreferExecuted(txs);
    const filtered = this.filterActivityTransactionsByStatus(deduped, status);
    const sliced = typeof limit === 'number' && limit >= 0 ? filtered.slice(0, limit) : filtered;
    return Promise.all(sliced.map((tx) => this.toActivityInterface(tx)));
  }

  async getTransactionById(txId: string): Promise<ITransaction | null> {
    try {
      const tx = await this.database.get<Tx>(TableName.Tx).find(txId);
      return this.toInterface(tx);
    } catch {
      return null;
    }
  }

  /**
   * Transaction detail adapter for UI.
   * Returns a stable plain snapshot and avoids WatermelonDB model exposure.
   */
  async getTransactionDetail(txId: string): Promise<ITransactionDetail | null> {
    const tx = await this.findTxOrNull(txId);
    if (!tx) return null;
    return this.toDetailInterface(tx);
  }

  // get recently addresses
  async getRecentlyAddresses(addressId: string, limit = 20): Promise<RecentlyAddress[]> {
    if (limit <= 0) {
      return [];
    }

    const ownerAddress = await this.findAddress(addressId);
    const ownerAddressValue = await ownerAddress.getValue();
    const ownerVariants = this.buildAddressVariants(ownerAddress, ownerAddressValue);
    const [localAddressLookup, txs] = await Promise.all([this.buildLocalAddressLookup(), this.createTxQuery(addressId, 'all').fetch()]);
    const [payloadMap, assetTypeMap] = await Promise.all([this.buildTxPayloadMap(txs), this.buildTxAssetTypeMap(txs)]);

    const peers = new Map<string, RecentlyAddress>();
    for (const tx of txs) {
      const payload = payloadMap.get(tx.txPayload.id);
      if (!payload) {
        continue;
      }

      const peer = this.resolvePeerAddress(tx, payload, assetTypeMap.get(tx.asset.id) ?? null, ownerAddressValue, ownerVariants, localAddressLookup);
      if (!peer) {
        continue;
      }

      const snapshot: RecentlyAddress = {
        addressValue: peer.addressValue,
        direction: peer.direction,
        isLocalAccount: peer.isLocalAccount,
        lastUsedAt: peer.lastUsedAt,
      };

      const existing = peers.get(peer.valueNormalized);
      if (!existing || snapshot.lastUsedAt > existing.lastUsedAt) {
        peers.set(peer.valueNormalized, snapshot);
      }
    }

    return Array.from(peers.values())
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, limit);
  }

  private createTxQuery(addressId: string, status: TransactionFilter['status'] = 'all') {
    const clauses: Q.Clause[] = [
      Q.where('address_id', addressId),
      Q.where('is_temp_replaced', Q.notEq(true)),
      ...this.buildStatusClauses(status),
      Q.sortBy('send_at', Q.desc),
      Q.sortBy('created_at', Q.desc),
    ];

    return this.database.get<Tx>(TableName.Tx).query(...clauses);
  }

  // build status clauses
  private buildStatusClauses(status: TransactionFilter['status']): Q.Clause[] {
    if (status === 'pending') {
      return [Q.where('status', Q.oneOf(SERVICE_PENDING_ACTIVITY_TX_STATUSES))];
    }
    if (status === 'finished') {
      return [Q.where('status', Q.oneOf(SERVICE_FINISHED_ACTIVITY_TX_STATUSES))];
    }
    return [Q.where('status', Q.notEq(DbTxStatus.SEND_FAILED))];
  }

  private filterActivityTransactionsByStatus(txs: Tx[], status: TransactionFilter['status']): Tx[] {
    if (status === 'pending') {
      return txs.filter((tx) => SERVICE_PENDING_ACTIVITY_TX_STATUS_SET.has(tx.status));
    }

    if (status === 'finished') {
      return txs.filter((tx) => SERVICE_FINISHED_ACTIVITY_TX_STATUS_SET.has(tx.status));
    }

    return txs;
  }

  // build address variants
  private buildAddressVariants(address: Address, networkValue: string): Set<string> {
    const variants = new Set<string>();
    variants.add(networkValue.toLowerCase());
    variants.add(address.hex.toLowerCase());
    variants.add(address.base32.toLowerCase());
    return variants;
  }

  // build local address lookup
  private async buildLocalAddressLookup(): Promise<Map<string, string>> {
    const addresses = await this.database.get<Address>(TableName.Address).query().fetch();
    const networkIds = Array.from(new Set(addresses.map((item) => item.network.id).filter((id): id is string => typeof id === 'string' && id.length > 0)));
    const networks = networkIds.length
      ? await this.database
          .get<Network>(TableName.Network)
          .query(Q.where('id', Q.oneOf(networkIds)))
          .fetch()
      : [];
    const networkTypeById = new Map(networks.map((network) => [network.id, network.networkType]));

    const values = new Map<string, string>();
    for (const item of addresses) {
      const preferredValue = networkTypeById.get(item.network.id) === NetworkType.Conflux ? item.base32 : item.hex;
      if (item.hex) values.set(item.hex.toLowerCase(), preferredValue);
      if (item.base32) values.set(item.base32.toLowerCase(), preferredValue);
      values.set(preferredValue.toLowerCase(), preferredValue);
    }
    return values;
  }

  private async buildTxPayloadMap(txs: Tx[]): Promise<Map<string, TxPayload>> {
    const payloadIds = Array.from(new Set(txs.map((tx) => tx.txPayload.id).filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (!payloadIds.length) {
      return new Map();
    }

    const payloads = await this.database
      .get<TxPayload>(TableName.TxPayload)
      .query(Q.where('id', Q.oneOf(payloadIds)))
      .fetch();

    return new Map(payloads.map((payload) => [payload.id, payload]));
  }

  private async buildTxAssetTypeMap(txs: Tx[]): Promise<Map<string, AssetTypeValue>> {
    const assetIds = Array.from(
      new Set(
        txs
          .filter((tx) => tx.method === 'transfer')
          .map((tx) => tx.asset.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (!assetIds.length) {
      return new Map();
    }

    const assets = await this.database
      .get<Asset>(TableName.Asset)
      .query(Q.where('id', Q.oneOf(assetIds)))
      .fetch();

    return new Map(assets.map((asset) => [asset.id, this.mapAssetTypeSnapshot(asset.type)]));
  }

  // get peer address by tx
  private resolvePeerAddress(
    tx: Tx,
    payload: TxPayload,
    assetType: AssetTypeValue | null,
    ownerAddressValue: string,
    ownerVariants: Set<string>,
    localAddressLookup: Map<string, string>,
  ): { addressValue: string; valueNormalized: string; direction: 'inbound' | 'outbound'; isLocalAccount: boolean; lastUsedAt: number } | null {
    const display = this.deriveDisplay({
      method: tx.method,
      payload,
      assetType,
    });

    if (!display.isTransfer) {
      return null;
    }

    const displayFrom = display.from ?? payload.from ?? ownerAddressValue;
    const displayTo = display.to ?? null;
    const lowerCaseFrom = this.toLowerCaseAddress(displayFrom);
    const lowerCaseTo = this.toLowerCaseAddress(displayTo);
    const lastUsedAt = tx.sendAt?.getTime() ?? tx.createdAt.getTime();

    if (lowerCaseFrom && ownerVariants.has(lowerCaseFrom)) {
      return this.buildRecentlyPeerSnapshot(displayTo, 'outbound', localAddressLookup, lastUsedAt);
    }

    if (lowerCaseTo && ownerVariants.has(lowerCaseTo)) {
      return this.buildRecentlyPeerSnapshot(displayFrom, 'inbound', localAddressLookup, lastUsedAt);
    }

    return null;
  }

  private buildRecentlyPeerSnapshot(
    peerValue: string | null,
    direction: 'inbound' | 'outbound',
    localAddressLookup: Map<string, string>,
    lastUsedAt: number,
  ): { addressValue: string; valueNormalized: string; direction: 'inbound' | 'outbound'; isLocalAccount: boolean; lastUsedAt: number } | null {
    if (!peerValue) {
      return null;
    }

    const localAddressValue = localAddressLookup.get(peerValue.toLowerCase());
    const canonicalValue = localAddressValue ?? peerValue;

    return {
      addressValue: canonicalValue,
      valueNormalized: canonicalValue.toLowerCase(),
      direction,
      isLocalAccount: !!localAddressValue,
      lastUsedAt,
    };
  }

  private toLowerCaseAddress(value?: string | null): string | null {
    return value ? value.toLowerCase() : null;
  }

  private assertPreparedNetworkType(preparedNetworkType: NetworkType, actualNetworkType: NetworkType, preparedKind: string): void {
    if (preparedNetworkType === actualNetworkType) {
      return;
    }

    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Prepared transaction network type does not match the address network.',
      context: { preparedNetworkType, actualNetworkType, preparedKind },
    });
  }

  private toLegacyAssetType(asset: PreparedTransferAsset): AssetType {
    switch (asset.standard) {
      case 'native':
        return AssetType.Native;
      case 'erc20':
      case 'crc20':
        return AssetType.ERC20;
      case 'erc721':
      case 'crc721':
        return AssetType.ERC721;
      case 'erc1155':
      case 'crc1155':
        return AssetType.ERC1155;
      default:
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Prepared transfer asset standard is not supported by the legacy execution adapter.',
          context: { standard: asset.standard, kind: asset.kind },
        });
    }
  }

  private getPendingCountLimit(): number {
    const limit = Math.floor(this.config?.wallet?.pendingCountLimit ?? 5);
    return Number.isFinite(limit) && limit > 0 ? limit : 5;
  }

  private pickMedian(values: readonly bigint[]): bigint | null {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    return sorted[Math.floor((sorted.length - 1) / 2)] ?? null;
  }

  private toHex(value: bigint): Hex {
    return OxHex.fromNumber(value) as Hex;
  }

  private toBigInt(value: Hex): bigint {
    return OxHex.toBigInt(value as OxHex.Hex);
  }

  private toRpcBigInt(value: unknown): bigint | null {
    if (value === undefined || value === null) {
      return null;
    }

    try {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') return BigInt(value);
      if (typeof value === 'string' && value.length > 0) return BigInt(value);
      if (typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
        const stringified = (value as { toString(): string }).toString();
        return stringified.length > 0 ? BigInt(stringified) : null;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async getGasPrice(params: { chainProvider: IChainProvider; network: Pick<Network, 'networkType'> }): Promise<Hex> {
    const { chainProvider, network } = params;
    const method = network.networkType === NetworkType.Conflux ? 'cfx_gasPrice' : 'eth_gasPrice';
    return (await chainProvider.rpc.request(method)) as Hex;
  }

  private async is1559Supported(params: { chainProvider: IChainProvider; network: Pick<Network, 'networkType'> }): Promise<boolean> {
    const { chainProvider, network } = params;
    if (network.networkType === NetworkType.Conflux) {
      const block = (await chainProvider.rpc.request('cfx_getBlockByEpochNumber', ['latest_state', false])) as { baseFeePerGas?: unknown };
      return typeof block?.baseFeePerGas === 'string';
    }
    const block = (await chainProvider.rpc.request('eth_getBlockByNumber', ['latest', false])) as { baseFeePerGas?: unknown };
    return typeof block?.baseFeePerGas === 'string';
  }

  private async estimateEvmGasLimit(params: {
    chainProvider: IChainProvider;
    from: string;
    to?: string;
    data: string;
    value: string;
    gasBuffer: number;
  }): Promise<Hex> {
    const gas = (await params.chainProvider.rpc.request('eth_estimateGas', [
      {
        from: params.from,
        to: params.to,
        value: params.value,
        data: params.data,
      },
      'latest',
    ])) as Hex;

    return this.applyGasBuffer(this.toBigInt(gas), params.gasBuffer);
  }

  private async estimateCfxGasAndCollateral(params: {
    chainProvider: IChainProvider;
    from: string;
    to?: string;
    data: string;
    value: string;
    gasBuffer: number;
  }): Promise<{ gasLimit: Hex; storageLimit: Hex }> {
    const result = (await params.chainProvider.rpc.request('cfx_estimateGasAndCollateral', [
      {
        from: params.from,
        to: params.to,
        value: params.value,
        data: params.data,
      },
      'latest_state',
    ])) as { gasLimit: Hex; storageCollateralized: Hex };

    return { gasLimit: this.applyGasBuffer(this.toBigInt(result.gasLimit), params.gasBuffer), storageLimit: result.storageCollateralized };
  }

  private getMinGasPrice(network: Pick<Network, 'chainId' | 'networkType'>): Hex {
    const cfg = this.config?.wallet?.gas;
    const chainId = network.chainId.toLowerCase();

    const gwei = cfg?.minGasPriceGweiByChain?.[network.networkType]?.[chainId] ?? cfg?.minGasPriceGweiByNetworkType?.[network.networkType];

    if (gwei != null) return this.toHex(OxValue.fromGwei(String(gwei)));

    if (network.networkType === NetworkType.Conflux) return this.toHex(OxValue.fromGwei('1'));

    const eSpaceChainIds = [Networks['Conflux eSpace'].chainId, Networks['eSpace Testnet'].chainId] as const;
    if (network.networkType === NetworkType.Ethereum && eSpaceChainIds.includes(network.chainId as (typeof eSpaceChainIds)[number])) {
      return this.toHex(OxValue.fromGwei('20'));
    }

    return '0x0';
  }

  private clampGasPrice(gasPrice: Hex, network: Pick<Network, 'chainId' | 'networkType'>): Hex {
    const min = this.getMinGasPrice(network);
    return this.toBigInt(gasPrice) < this.toBigInt(min) ? min : gasPrice;
  }

  private scaleGasPrice(base: bigint, level: GasLevel): bigint {
    switch (level) {
      case 'high':
        return (base * 12n) / 10n;
      case 'low':
        return (base * 9n) / 10n;
      default:
        return base;
    }
  }

  private applyGasBuffer(value: bigint, gasBuffer: number): Hex {
    // Use integer math to avoid float precision loss (gas values are bigint).
    const factor = BigInt(Math.round(gasBuffer * 1000));
    const buffered = (value * factor + 999n) / 1000n; // ceil
    return this.toHex(buffered);
  }

  private buildLegacyLevels(params: {
    gasPrice: Hex;
    gasLimit: Hex;
    network: Pick<Network, 'chainId' | 'networkType'>;
  }): Record<GasLevel, { gasPrice: Hex; gasCost: Hex }> {
    const gasLimit = this.toBigInt(params.gasLimit);
    const base = this.toBigInt(params.gasPrice);

    return Object.fromEntries(
      GAS_LEVELS.map((level) => {
        const scaled = this.scaleGasPrice(base, level);
        const suggestedGasPrice = this.clampGasPrice(this.toHex(scaled), params.network);
        const gasCost = this.toHex(this.toBigInt(suggestedGasPrice) * gasLimit);
        return [level, { gasPrice: suggestedGasPrice, gasCost }];
      }),
    ) as Record<GasLevel, { gasPrice: Hex; gasCost: Hex }>;
  }

  private buildEip1559Levels(params: {
    gasPrice: Hex;
    gasLimit: Hex;
    network: Pick<Network, 'chainId' | 'networkType'>;
  }): Record<GasLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }> {
    const gasLimit = this.toBigInt(params.gasLimit);
    const base = this.toBigInt(params.gasPrice);

    return Object.fromEntries(
      GAS_LEVELS.map((level) => {
        const scaled = this.scaleGasPrice(base, level);
        const maxFeePerGas = this.clampGasPrice(this.toHex(scaled), params.network);
        const maxPriorityFeePerGas = maxFeePerGas;
        const gasCost = this.toHex(this.toBigInt(maxFeePerGas) * gasLimit);
        return [level, { maxFeePerGas, maxPriorityFeePerGas, gasCost }];
      }),
    ) as Record<GasLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }>;
  }

  private async buildConfluxPricing(params: {
    chainProvider: IChainProvider;
    gasPrice: Hex;
    gasLimit: Hex;
    network: Pick<Network, 'chainId' | 'networkType'>;
  }): Promise<GasPricingEstimate['pricing']> {
    const baseFeePerGas = await this.getConfluxBaseFeePerGas(params.chainProvider);
    if (baseFeePerGas === null) {
      return {
        kind: 'legacy',
        levels: this.buildLegacyLevels({
          gasPrice: params.gasPrice,
          gasLimit: params.gasLimit,
          network: params.network,
        }),
      };
    }

    const levels = await this.buildConfluxEip1559Levels({ ...params, baseFeePerGas });
    return {
      kind: 'eip1559',
      levels: levels ?? this.buildEip1559Levels({ gasPrice: params.gasPrice, gasLimit: params.gasLimit, network: params.network }),
    };
  }

  private async getConfluxBaseFeePerGas(chainProvider: IChainProvider): Promise<bigint | null> {
    const block = (await chainProvider.rpc.request('cfx_getBlockByEpochNumber', ['latest_state', false])) as { baseFeePerGas?: unknown };
    return this.toRpcBigInt(block?.baseFeePerGas);
  }

  private async buildConfluxEip1559Levels(params: {
    chainProvider: IChainProvider;
    gasPrice: Hex;
    gasLimit: Hex;
    network: Pick<Network, 'chainId' | 'networkType'>;
    baseFeePerGas: bigint;
  }): Promise<Record<GasLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }> | null> {
    try {
      const feeHistory = (await params.chainProvider.rpc.request('cfx_feeHistory', [
        CONFLUX_EIP1559_FEE_HISTORY_BLOCKS,
        'latest_state',
        [...CONFLUX_EIP1559_FEE_HISTORY_PERCENTILES],
      ])) as { reward?: unknown[] };
      const fallbackLevels = this.buildEip1559Levels({
        gasPrice: params.gasPrice,
        gasLimit: params.gasLimit,
        network: params.network,
      });
      const gasLimit = this.toBigInt(params.gasLimit);

      return Object.fromEntries(
        GAS_LEVELS.map((level, rewardIndex) => {
          const sampledPriorityFees = Array.isArray(feeHistory.reward)
            ? feeHistory.reward
                .map((rewards) => (Array.isArray(rewards) ? this.toRpcBigInt(rewards[rewardIndex]) : null))
                .filter((value): value is bigint => value !== null)
            : [];
          const suggestedMaxPriorityFeePerGas = this.pickMedian(sampledPriorityFees);
          if (suggestedMaxPriorityFeePerGas === null) {
            return [level, fallbackLevels[level]];
          }

          const adjustedBaseFeePerGas = (params.baseFeePerGas * CONFLUX_EIP1559_BASE_FEE_MULTIPLIERS[level]) / 100n;
          const maxFeePerGas = this.clampGasPrice(this.toHex(adjustedBaseFeePerGas + suggestedMaxPriorityFeePerGas), params.network);
          const gasCost = this.toHex(this.toBigInt(maxFeePerGas) * gasLimit);

          return [
            level,
            {
              maxFeePerGas,
              maxPriorityFeePerGas: this.toHex(suggestedMaxPriorityFeePerGas),
              gasCost,
            },
          ];
        }),
      ) as Record<GasLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }>;
    } catch {
      return null;
    }
  }

  private async findTxOrNull(txId: string): Promise<Tx | null> {
    try {
      return await this.database.get<Tx>(TableName.Tx).find(txId);
    } catch {
      return null;
    }
  }

  private async findTxOrThrow(txId: string): Promise<Tx> {
    const tx = await this.findTxOrNull(txId);
    if (!tx) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Transaction not found.',
        context: { txId },
      });
    }
    return tx;
  }

  private async uniqSortByNoncePreferExecuted(txs: Tx[]): Promise<Tx[]> {
    if (txs.length === 0) return [];

    const payloads = await Promise.all(txs.map((tx) => tx.txPayload.fetch()));

    const nonceMap = new Map<number, Tx>();
    const noNonce: Tx[] = [];

    for (let i = 0; i < txs.length; i += 1) {
      const tx = txs[i];
      const nonce = payloads[i]?.nonce;
      if (typeof nonce !== 'number') {
        noNonce.push(tx);
        continue;
      }

      const prev = nonceMap.get(nonce);
      if (!prev) {
        nonceMap.set(nonce, tx);
        continue;
      }

      // If we have multiple txs with the same nonce, prefer an executed-like one (same as legacy Activity behavior).
      if (EXECUTED_TX_STATUSES.includes(tx.status)) {
        nonceMap.set(nonce, tx);
      }
    }

    const byNonceDesc = Array.from(nonceMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, tx]) => tx);

    // Keep unknown-nonce txs (rare) after nonce-sorted list to preserve visibility.
    return [...byNonceDesc, ...noNonce];
  }

  private async toInterface(tx: Tx): Promise<ITransaction> {
    const address = await tx.address.fetch();
    const network = await address.network.fetch();
    const txPayload = await tx.txPayload.fetch();
    const from = await this.resolvePayloadFrom(address, txPayload);
    const state = this.buildState(tx.status, tx.executedStatus ?? null);

    return {
      id: tx.id,
      hash: tx.hash ?? '',
      from: from ?? '',
      to: txPayload.to ?? '',
      value: txPayload.value ?? '0',
      state,
      timestamp: tx.createdAt.getTime(),
      networkId: network.id,
    };
  }

  private normalizeSource(source: string | null | undefined): TransactionSource {
    if (source === TxSource.SELF) return 'self';
    if (source === TxSource.DAPP) return 'dapp';
    if (source === TxSource.SCAN) return 'scan';
    return 'unknown';
  }

  private toAssetSnapshot(asset: Asset | null): TransactionAssetSnapshot | null {
    if (!asset) return null;
    return {
      type: this.mapAssetTypeSnapshot(asset.type),
      contractAddress: asset.contractAddress,
      name: asset.name,
      symbol: asset.symbol,
      decimals: asset.decimals,
      icon: asset.icon,
      priceInUSDT: asset.priceInUSDT,
    };
  }

  private mapAssetTypeSnapshot(value: unknown): AssetTypeValue {
    const type = String(value ?? '');
    if (type === ASSET_TYPE.Native) return ASSET_TYPE.Native;
    if (type === ASSET_TYPE.ERC20) return ASSET_TYPE.ERC20;
    if (type === ASSET_TYPE.ERC721) return ASSET_TYPE.ERC721;
    if (type === ASSET_TYPE.ERC1155) return ASSET_TYPE.ERC1155;
    return ASSET_TYPE.ERC20;
  }

  private toNetworkSnapshot(network: Network): TransactionNetworkSnapshot {
    return {
      id: network.id,
      name: network.name,
      chainId: network.chainId,
      networkType: network.networkType,
      scanUrl: network.scanUrl,
    };
  }

  private toPayloadSnapshot(payload: TxPayload, fallbackFrom: string | null = null): TransactionPayloadSnapshot {
    return {
      from: payload.from ?? fallbackFrom,
      to: payload.to ?? null,
      value: payload.value ?? null,
      data: (payload.data as Hex | null) ?? null,
      nonce: typeof payload.nonce === 'number' ? payload.nonce : null,
      chainId: payload.chainId ?? null,
      gasLimit: payload.gasLimit ?? null,
      gasPrice: payload.gasPrice ?? null,
      maxFeePerGas: payload.maxFeePerGas ?? null,
      maxPriorityFeePerGas: payload.maxPriorityFeePerGas ?? null,
      storageLimit: payload.storageLimit ?? null,
      epochHeight: payload.epochHeight ?? null,
      type: payload.type ?? null,
    };
  }

  private toExtraSnapshot(extra: TxExtra): TransactionExtraSnapshot {
    return { sendAction: (extra.sendAction as SpeedUpAction | null) ?? null };
  }

  private toReceiptSnapshot(receipt: Tx['receipt']): TransactionReceiptSnapshot | null {
    if (!receipt) return null;
    const r = receipt as any;

    const hasEvmFields = r.cumulativeGasUsed != null || r.effectiveGasPrice != null;
    const hasCfxFields = r.gasFee != null || r.storageCollateralized != null || r.gasCoveredBySponsor != null || r.storageCoveredBySponsor != null;
    const kind: TransactionReceiptSnapshot['kind'] = hasEvmFields ? 'evm' : hasCfxFields ? 'cfx' : 'unknown';

    return {
      kind,
      blockHash: r.blockHash ?? null,
      gasUsed: r.gasUsed ?? null,
      contractCreated: r.contractCreated ?? null,
      transactionIndex: r.transactionIndex ?? null,
      effectiveGasPrice: r.effectiveGasPrice ?? null,
      type: r.type ?? null,
      blockNumber: r.blockNumber ?? null,
      cumulativeGasUsed: r.cumulativeGasUsed ?? null,
      gasFee: r.gasFee ?? null,
      storageCollateralized: r.storageCollateralized ?? null,
      gasCoveredBySponsor: r.gasCoveredBySponsor ?? null,
      storageCoveredBySponsor: r.storageCoveredBySponsor ?? null,
      storageReleased: Array.isArray(r.storageReleased) ? r.storageReleased : undefined,
    };
  }

  private deriveDisplay(params: { method: string; payload: TxPayload; assetType: AssetTypeValue | null }): TransactionDisplaySnapshot {
    const { method, payload, assetType } = params;

    let from = payload.from ?? null;
    let to = payload.to ?? null;
    let value = payload.value ?? null;
    let tokenId = '';
    let isTransfer = false;

    const data = payload.data ?? null;

    try {
      if (method === 'transferFrom' && data) {
        const params = iface721.decodeFunctionData('transferFrom', data);
        from = (params[0] as string) ?? from;
        to = (params[1] as string) ?? to;
        tokenId = params[2]?.toString?.() ?? '';
        value = '1';
        isTransfer = true;
      } else if (method === 'safeTransferFrom' && data) {
        const params = iface1155.decodeFunctionData('safeTransferFrom', data);
        from = (params[0] as string) ?? from;
        to = (params[1] as string) ?? to;
        tokenId = params[2]?.toString?.() ?? '';
        value = params[3]?.toString?.() ?? value;
        isTransfer = true;
      } else if (method === 'transfer') {
        // Native transfers (or unknown asset type with empty calldata) should still be treated as transfers.
        if (assetType === AssetType.Native || !data || data === '0x') {
          isTransfer = true;
        } else {
          const params = iface777.decodeFunctionData('transfer', data);
          to = (params[0] as string) ?? to;
          value = params[1]?.toString?.() ?? value;
          isTransfer = true;
        }
      }
    } catch {
      // Best effort: keep raw payload fields.
    }

    // Approve value is shown for `approve` method when decoding is possible.
    if (!isTransfer && method === 'approve' && data) {
      try {
        const erc20 = iface777.decodeFunctionData('approve', data);
        value = erc20[1]?.toString?.() ?? value;
      } catch {
        try {
          const erc721 = iface721.decodeFunctionData('approve', data);
          value = erc721[1]?.toString?.() ?? value;
        } catch {
          // ignore
        }
      }
    }

    return { from, to, value, tokenId, isTransfer };
  }

  private async loadTxAssetOrNull(tx: Tx): Promise<Asset | null> {
    try {
      const asset = await tx.asset.fetch();
      return asset ?? null;
    } catch {
      return null;
    }
  }

  private async loadNativeAssetForAddressOrNull(params: { address: Address; network: Network }): Promise<Asset | null> {
    const { address, network } = params;
    const assetRule = await address.assetRule.fetch();

    const res = await this.database
      .get<Asset>(TableName.Asset)
      .query(Q.where('asset_rule_id', assetRule.id), Q.where('network_id', network.id), Q.where('type', AssetType.Native as any))
      .fetch();

    return res[0] ?? null;
  }

  private async toActivityInterface(tx: Tx): Promise<IActivityTransaction> {
    const [address, payload, extra] = await Promise.all([tx.address.fetch(), tx.txPayload.fetch(), tx.txExtra.fetch()]);
    const network = await address.network.fetch();
    const from = await this.resolvePayloadFrom(address, payload);
    const state = this.buildState(tx.status, tx.executedStatus ?? null);

    const asset = await this.loadTxAssetOrNull(tx);
    const assetSnapshot = this.toAssetSnapshot(asset);
    const createdAtMs = tx.createdAt.getTime();
    const executedAtMs = tx.executedAt ? tx.executedAt.getTime() : null;
    const sendAtMs = tx.sendAt ? tx.sendAt.getTime() : createdAtMs;
    const timestampMs = executedAtMs ?? sendAtMs ?? createdAtMs;

    return {
      id: tx.id,
      hash: tx.hash ?? '',
      state,
      source: this.normalizeSource(tx.source),
      method: tx.method,

      createdAtMs,
      executedAtMs,
      sendAtMs,
      timestampMs,

      networkId: network.id,
      sendAction: (extra.sendAction as SpeedUpAction | null) ?? null,

      payload: this.toPayloadSnapshot(payload, from),
      asset: assetSnapshot,
      display: this.deriveDisplay({ method: tx.method, payload, assetType: assetSnapshot?.type ?? null }),
    };
  }

  private async toDetailInterface(tx: Tx): Promise<ITransactionDetail> {
    const [address, payload, extra] = await Promise.all([tx.address.fetch(), tx.txPayload.fetch(), tx.txExtra.fetch()]);
    const network = await address.network.fetch();
    const from = await this.resolvePayloadFrom(address, payload);
    const state = this.buildState(tx.status, tx.executedStatus ?? null);

    const [asset, nativeAsset] = await Promise.all([this.loadTxAssetOrNull(tx), this.loadNativeAssetForAddressOrNull({ address, network })]);

    const assetSnapshot = this.toAssetSnapshot(asset);
    const nativeAssetSnapshot = this.toAssetSnapshot(nativeAsset);
    const createdAtMs = tx.createdAt.getTime();
    const executedAtMs = tx.executedAt ? tx.executedAt.getTime() : null;
    const sendAtMs = tx.sendAt ? tx.sendAt.getTime() : createdAtMs;

    return {
      id: tx.id,
      hash: tx.hash ?? '',
      state,
      source: this.normalizeSource(tx.source),
      method: tx.method,

      createdAtMs,
      executedAtMs,
      sendAtMs,

      network: this.toNetworkSnapshot(network),
      asset: assetSnapshot,
      nativeAsset: nativeAssetSnapshot,

      payload: this.toPayloadSnapshot(payload, from),
      extra: this.toExtraSnapshot(extra),
      receipt: this.toReceiptSnapshot(tx.receipt),

      err: tx.err ?? null,
      errorType: tx.errorType ? String(tx.errorType) : null,

      display: this.deriveDisplay({ method: tx.method, payload, assetType: assetSnapshot?.type ?? null }),
    };
  }

  private async resolvePayloadFrom(address: Address, payload: TxPayload): Promise<string | null> {
    return payload.from ?? (await address.getValue());
  }
}
