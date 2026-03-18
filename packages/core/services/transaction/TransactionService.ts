import { ChainRegistry } from '@core/chains';
import { iface721, iface777, iface1155 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { App } from '@core/database/models/App';
import type { Asset } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import { SignType } from '@core/database/models/Signature/type';
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
  TX_BROADCAST_FAILED,
  TX_BUILD_FAILED,
  TX_ESTIMATE_FAILED,
  TX_INVALID_PARAMS,
  TX_SAVE_FAILED,
  TX_SIGN_ADDRESS_MISMATCH,
  TX_SIGN_TRANSACTION_FAILED,
  TX_SIGN_UNSUPPORTED_NETWORK,
} from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import type { RuntimeConfig } from '@core/runtime/types';
import { AddressValidationService } from '@core/services/address/AddressValidationService';
import { SigningService } from '@core/services/signing';
import { SignatureRecordService } from '@core/services/signing/SignatureRecordService';
import {
  ASSET_TYPE,
  AssetType,
  type AssetTypeValue,
  type ChainType,
  type EvmChainProviderLike,
  type EvmUnsignedTransaction,
  type FeeEstimate,
  type HardwareOperationError,
  type Hex,
  type IChainProvider,
  NetworkType,
  SPEED_UP_ACTION,
  type SpeedUpAction,
  type TransactionParams,
  type TransactionStateSnapshot,
  TX_EXECUTION_STATUS,
  TX_LIFECYCLE_STATUS,
  type UnsignedTransaction,
} from '@core/types';
import { Networks } from '@core/utils/consts';
import { ProcessErrorType } from '@core/utils/eth';
import { type ParseTxDataReturnType, parseTxData } from '@core/utils/txData';
import { Interface } from '@ethersproject/abi';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import * as OxHex from 'ox/Hex';
import * as OxValue from 'ox/Value';
import type { EvmRpcTransactionRequest } from './dappTypes';
import { resolveTransactionMethod } from './methodResolver';
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

type TxLike = {
  from?: string;
  to?: string;
  value?: string;
  data?: string;
};

const GAS_LEVELS = ['low', 'medium', 'high'] as const;
type GasLevel = (typeof GAS_LEVELS)[number];

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

  @inject(SigningService)
  private readonly signingService!: SigningService;

  @inject(SignatureRecordService)
  private readonly signatureRecordService!: SignatureRecordService;

  @inject(CORE_IDENTIFIERS.EVENT_BUS)
  @optional()
  private readonly eventBus?: EventBus<CoreEventMap>;

  private emitTxCreated(params: { addressId: string; networkId: string; txId: string }): void {
    this.eventBus?.emit('tx/created', {
      key: { addressId: params.addressId, networkId: params.networkId },
      txId: params.txId,
    });
  }

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
    const nonce = withNonce ? await chainProvider.getNonce(from) : 0;

    const [gasPrice, supports1559] = await Promise.all([this.getGasPrice({ chainProvider, network }), this.is1559Supported({ chainProvider, network })]);

    const minGasPriceWei = this.getMinGasPrice(network);

    if (network.networkType === NetworkType.Ethereum) {
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

      if (isSendNativeToken) {
        const gasLimit = this.applyGasBuffer(21_000n, gasBuffer);
        const storageLimit = '0x0' as const;

        return {
          gasLimit,
          storageLimit,
          gasPrice,
          constraints: { minGasPriceWei },
          pricing: supports1559
            ? { kind: 'eip1559', levels: this.buildEip1559Levels({ gasPrice, gasLimit, network }) }
            : { kind: 'legacy', levels: this.buildLegacyLevels({ gasPrice, gasLimit, network }) },
          nonce,
        };
      }

      const { gasLimit, storageLimit } = await this.estimateCfxGasAndCollateral({ chainProvider, from, to, data, value, gasBuffer });

      return {
        gasLimit,
        storageLimit,
        gasPrice,
        constraints: { minGasPriceWei },
        pricing: supports1559
          ? { kind: 'eip1559', levels: this.buildEip1559Levels({ gasPrice, gasLimit, network }) }
          : { kind: 'legacy', levels: this.buildLegacyLevels({ gasPrice, gasLimit, network }) },
        nonce,
      };
    }

    throw new Error(`estimateGasPricing: unsupported networkType: ${String(network.networkType)}`);
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
    // load address and network
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);
    const chainProvider = this.getChainProvider(network);

    const from = await address.getValue();

    // build tx params
    const txParams = this.buildTransactionParams(input, from, network);
    const txDraft = await chainProvider.buildTransaction(txParams);
    const unsignedTx = await chainProvider.prepareUnsignedTransaction(txDraft);

    // get signer
    const account = await address.account.fetch();
    const signer = await this.signingService.getSigner(account.id, address.id, { signal: input.signal });

    // sign
    const requestId = this.createRequestId();
    let signedTx: Awaited<ReturnType<IChainProvider['signTransaction']>>;

    if (signer.type === 'hardware') {
      this.eventBus?.emit('hardware-sign/started', {
        requestId,
        accountId: account.id,
        addressId: address.id,
        networkId: network.id,
      });

      try {
        signedTx = await chainProvider.signTransaction(unsignedTx, signer, { signal: input.signal });
      } catch (error) {
        if (input.signal?.aborted) {
          this.eventBus?.emit('hardware-sign/aborted', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
          });
        } else {
          this.eventBus?.emit('hardware-sign/failed', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
            error: this.toHardwareOperationError(error),
          });
        }
        throw error;
      }

      this.eventBus?.emit('hardware-sign/succeeded', {
        requestId,
        accountId: account.id,
        addressId: address.id,
        networkId: network.id,
        txHash: signedTx.hash,
        rawTransaction: signedTx.rawTransaction,
      });
    } else {
      signedTx = await chainProvider.signTransaction(unsignedTx, signer);
    }
    let signatureId: string | null = null;
    try {
      signatureId = await this.signatureRecordService.createRecord({
        addressId: address.id,
        signType: SignType.TX,
      });
    } catch {
      signatureId = null;
    }

    const sendAt = new Date();

    let tx: Tx;

    try {
      // broadcast
      const txHash = await chainProvider.broadcastTransaction(signedTx);

      // save success tx
      tx = await this.saveTx({
        address,
        unsignedTx,
        txHash,
        txRaw: signedTx.rawTransaction,
        assetType: input.assetType,
        contractAddress: input.contractAddress,
        sendAt,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // save failed tx
      tx = await this.saveTx({
        address,
        unsignedTx,
        txHash: '',
        txRaw: signedTx.rawTransaction,
        assetType: input.assetType,
        contractAddress: input.contractAddress,
        sendAt,
        isFailed: true,
        err: message,
        errorType: null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
      }

      this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: tx.id });
      throw error;
    }
    this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: tx.id });
    return this.toInterface(tx);
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
    const address = await this.findAddress(input.addressId);
    const network = await this.getNetwork(address);

    if (network.networkType !== NetworkType.Ethereum) {
      throw new CoreError({
        code: TX_SIGN_UNSUPPORTED_NETWORK,
        message: 'TransactionService.sendDappTransaction is only supported for Ethereum networks.',
        context: { networkType: network.networkType, chainId: network.chainId },
      });
    }

    const currentAddressValue = (await address.getValue()).toLowerCase();
    if (input.request.from.toLowerCase() !== currentAddressValue) {
      throw new CoreError({
        code: TX_SIGN_ADDRESS_MISMATCH,
        message: 'TransactionService.sendDappTransaction address mismatch.',
        context: { expectedFrom: currentAddressValue, from: input.request.from },
      });
    }

    const chainProvider = this.getChainProvider<EvmChainProviderLike>(network);

    let unsignedTx: EvmUnsignedTransaction;
    try {
      const txDraft = this.buildEvmUnsignedTransactionDraft({ chainId: network.chainId, request: input.request });
      unsignedTx = await chainProvider.prepareUnsignedTransaction(txDraft);
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_BUILD_FAILED,
        message: 'Failed to prepare dApp transaction.',
        cause: error,
        context: { chainId: network.chainId },
      });
    }

    const account = await address.account.fetch();
    const signer = await this.signingService.getSigner(account.id, address.id, { signal: input.signal });

    const requestId = this.createRequestId();
    let signedTx: Awaited<ReturnType<IChainProvider['signTransaction']>>;

    try {
      if (signer.type === 'hardware') {
        this.eventBus?.emit('hardware-sign/started', {
          requestId,
          accountId: account.id,
          addressId: address.id,
          networkId: network.id,
        });

        signedTx = await chainProvider.signTransaction(unsignedTx, signer, { signal: input.signal });

        this.eventBus?.emit('hardware-sign/succeeded', {
          requestId,
          accountId: account.id,
          addressId: address.id,
          networkId: network.id,
          txHash: signedTx.hash,
          rawTransaction: signedTx.rawTransaction,
        });
      } else {
        signedTx = await chainProvider.signTransaction(unsignedTx, signer, { signal: input.signal });
      }
    } catch (error) {
      if (signer.type === 'hardware' && error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string') {
        throw error;
      }

      if (signer.type === 'hardware') {
        if (input.signal?.aborted) {
          this.eventBus?.emit('hardware-sign/aborted', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
          });
        } else {
          this.eventBus?.emit('hardware-sign/failed', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
            error: this.toHardwareOperationError(error),
          });
        }
      }

      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_SIGN_TRANSACTION_FAILED,
        message: 'Failed to sign dApp transaction.',
        cause: error,
        context: { signerType: signer.type, chainId: network.chainId },
      });
    }
    let signatureId: string | null = null;
    try {
      signatureId = await this.signatureRecordService.createRecord({
        addressId: address.id,
        signType: SignType.TX,
        app: input.app ?? null,
      });
    } catch {
      signatureId = null;
    }

    const sendAt = new Date();

    try {
      const txHash = await chainProvider.broadcastTransaction(signedTx);

      const tx = await this.saveDappTx({
        address,
        unsignedTx,
        txHash,
        txRaw: signedTx.rawTransaction,
        sendAt,
        app: input.app ?? null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
      }

      this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: tx.id });
      return this.toInterface(tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const tx = await this.saveDappTx({
          address,
          unsignedTx,
          txHash: '',
          txRaw: signedTx.rawTransaction,
          sendAt,
          isFailed: true,
          err: message,
          errorType: null,
          app: input.app ?? null,
        });

        if (signatureId) {
          await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
        }

        this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: tx.id });
      } catch (saveError) {
        if (saveError instanceof CoreError) throw saveError;
        throw new CoreError({
          code: TX_SAVE_FAILED,
          message: 'Failed to save dApp transaction after broadcast failure.',
          cause: saveError,
          context: { chainId: network.chainId },
        });
      }

      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_BROADCAST_FAILED,
        message: 'Failed to broadcast dApp transaction.',
        cause: error,
        context: { chainId: network.chainId },
      });
    }
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
        type: payload.type,
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
    const originTx = await this.findTxOrThrow(input.txId);

    const [address, payload, extra] = await Promise.all([originTx.address.fetch(), originTx.txPayload.fetch(), originTx.txExtra.fetch()]);
    const network = await this.getNetwork(address);
    const chainProvider = this.getChainProvider(network);

    if (!PENDING_TX_STATUSES.includes(originTx.status)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Transaction is not pending.',
        context: { txId: originTx.id, status: originTx.status },
      });
    }

    const from = payload.from ?? (await address.getValue());

    const effectiveAction: SpeedUpAction = extra.sendAction === SPEED_UP_ACTION.Cancel ? SPEED_UP_ACTION.Cancel : input.action;

    if (typeof payload.nonce !== 'number') {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Origin transaction nonce is missing.',
        context: { txId: originTx.id },
      });
    }
    if (payload.nonce !== input.nonce) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement nonce mismatch.',
        context: { txId: originTx.id, originNonce: payload.nonce, nonce: input.nonce },
      });
    }

    const is1559 = !!payload.maxFeePerGas;
    this.assertReplacementFeeBumped({
      is1559,
      origin: {
        gasPrice: payload.gasPrice ?? null,
        maxFeePerGas: payload.maxFeePerGas ?? null,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas ?? null,
      },
      next: input.feeOverrides,
    });

    const gasLimit = input.advanceOverrides?.gasLimit ?? payload.gasLimit ?? undefined;
    const storageLimit = input.advanceOverrides?.storageLimit ?? payload.storageLimit ?? undefined;

    const replacementTxPayload = await this.buildReplacementPayload({
      network,
      from,
      origin: payload,
      action: effectiveAction,
      feeOverrides: input.feeOverrides,
      gasLimit,
      storageLimit,
      nonce: input.nonce,
      chainProvider,
    });

    // get signer
    const account = await address.account.fetch();
    const signer = await this.signingService.getSigner(account.id, address.id, { signal: input.signal });

    const requestId = this.createRequestId();
    let signedTx: Awaited<ReturnType<IChainProvider['signTransaction']>>;

    try {
      if (signer.type === 'hardware') {
        this.eventBus?.emit('hardware-sign/started', {
          requestId,
          accountId: account.id,
          addressId: address.id,
          networkId: network.id,
        });
      }

      signedTx = await chainProvider.signTransaction(replacementTxPayload, signer, { signal: input.signal });

      if (signer.type === 'hardware') {
        this.eventBus?.emit('hardware-sign/succeeded', {
          requestId,
          accountId: account.id,
          addressId: address.id,
          networkId: network.id,
          txHash: signedTx.hash,
          rawTransaction: signedTx.rawTransaction,
        });
      }
    } catch (error) {
      if (signer.type === 'hardware') {
        if (input.signal?.aborted) {
          this.eventBus?.emit('hardware-sign/aborted', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
          });
        } else {
          this.eventBus?.emit('hardware-sign/failed', {
            requestId,
            accountId: account.id,
            addressId: address.id,
            networkId: network.id,
            error: this.toHardwareOperationError(error),
          });
        }
      }
      throw error;
    }

    let signatureId: string | null = null;
    try {
      signatureId = await this.signatureRecordService.createRecord({
        addressId: address.id,
        signType: SignType.TX,
      });
    } catch {
      signatureId = null;
    }

    const sendAt = new Date();

    try {
      const txHash = await chainProvider.broadcastTransaction(signedTx);

      const newTx = await this.saveReplacementTx({
        originTx,
        address,
        unsignedTx: replacementTxPayload,
        txHash,
        txRaw: signedTx.rawTransaction,
        sendAt,
        sendAction: effectiveAction,
        hideOriginAsTempReplaced: true,
        isFailed: false,
        err: null,
        errorType: null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: newTx.id });
      }

      this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: newTx.id });
      return this.toInterface(newTx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      const failed = await this.saveReplacementTx({
        originTx,
        address,
        unsignedTx: replacementTxPayload,
        txHash: '',
        txRaw: signedTx.rawTransaction,
        sendAt,
        sendAction: effectiveAction,
        hideOriginAsTempReplaced: false,
        isFailed: true,
        err: message,
        errorType: null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: failed.id });
      }

      this.emitTxCreated({ addressId: address.id, networkId: network.id, txId: failed.id });
      throw error;
    }
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

  private buildTransactionParams(input: SendTransactionInput, from: string, network: Network): TransactionParams {
    // TODO add more fields
    return {
      from,
      to: input.to,
      chainId: network.chainId,
      amount: input.amount,
      assetType: input.assetType,
      assetDecimals: input.assetDecimals,
      contractAddress: input.contractAddress,
      nftTokenId: input.nftTokenId,
      data: input.data,
      gasLimit: input.gasLimit,
      gasPrice: input.gasPrice,
      maxFeePerGas: input.maxFeePerGas,
      maxPriorityFeePerGas: input.maxPriorityFeePerGas,
      storageLimit: input.storageLimit,
      nonce: input.nonce,
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

  private async saveTx(params: {
    address: Address;
    unsignedTx: UnsignedTransaction;
    txHash: string;
    txRaw: string;
    assetType: AssetType;
    contractAddress?: string;
    sendAt: Date;
    isFailed?: boolean;
    err?: string;
    errorType?: ProcessErrorType | null;
  }): Promise<Tx> {
    const { address, unsignedTx, txHash, txRaw, assetType, contractAddress, sendAt, isFailed = false, err, errorType } = params;

    const payload: any = unsignedTx.payload ?? {};
    const txMethod = resolveTransactionMethod({ payload, assetType });

    const network = await address.network.fetch();
    const status = await this.resolveInitialTxStatus({
      address,
      network,
      from: payload.from ?? null,
      nonce: typeof payload.nonce === 'number' ? payload.nonce : null,
      isFailed,
    });
    const updated = await this.reuseTxByRaw({
      address,
      txRaw,
      pendingPayload: payload,
      txHash,
      status,
      sendAt,
      err: err ?? null,
      errorType: errorType ?? null,
      source: TxSource.SELF,
      method: txMethod,
    });
    if (updated) {
      return updated;
    }

    const txPayload = this.database.get<TxPayload>(TableName.TxPayload).prepareCreate((record) => {
      record.type = payload.type != null ? String(payload.type) : null;
      record.accessList = null;
      record.maxFeePerGas = payload.maxFeePerGas ?? null;
      record.maxPriorityFeePerGas = payload.maxPriorityFeePerGas ?? null;
      record.from = payload.from ?? null;
      record.to = payload.to ?? null;
      record.gasPrice = payload.gasPrice ?? null;
      record.gasLimit = payload.gasLimit ?? (payload.gas as string | undefined) ?? null;
      record.storageLimit = payload.storageLimit ?? null;
      record.data = payload.data ?? null;
      record.value = payload.value ?? null;
      record.nonce = typeof payload.nonce === 'number' ? payload.nonce : null;
      record.chainId = payload.chainId ?? null;
      record.epochHeight = payload.epochHeight != null ? String(payload.epochHeight) : null;
    });

    const txExtra = this.database.get<TxExtra>(TableName.TxExtra).prepareCreate((record) => {
      record.ok = true;
      record.simple = assetType === AssetType.Native;
      record.contractInteraction = assetType !== AssetType.Native;
      record.token20 = assetType === AssetType.ERC20;
      record.tokenNft = assetType === AssetType.ERC721 || assetType === AssetType.ERC1155;
      record.sendAction = null;
      record.address = payload.to ?? null;
      record.method = assetType === AssetType.ERC20 ? 'transfer' : null;
      record.contractCreation = !payload.to && !!payload.data;
    });

    let asset: Asset | undefined;
    const assets = await network.assets.fetch();
    if (assetType === AssetType.Native) {
      asset = assets.find((item) => item.type === AssetType.Native);
    } else if (contractAddress) {
      asset = await network.queryAssetByAddress(contractAddress);
    }

    const tx = this.database.get<Tx>(TableName.Tx).prepareCreate((record) => {
      record.raw = txRaw;
      record.hash = txHash;
      record.status = status;
      record.executedStatus = null;
      record.receipt = null;
      record.executedAt = null;
      record.errorType = errorType ?? null;
      record.err = err ?? null;
      record.sendAt = sendAt;
      record.resendAt = null;
      record.resendCount = null;
      record.isTempReplacedByInner = null;
      record.source = TxSource.SELF;
      record.method = txMethod;
      record.address.set(address);
      record.txPayload.set(txPayload);
      record.txExtra.set(txExtra);
      if (asset) {
        record.asset.set(asset);
      }
    });

    await this.database.write(async () => {
      await this.database.batch(txPayload, txExtra, tx);
    });

    return tx;
  }

  private async saveDappTx(params: {
    address: Address;
    unsignedTx: EvmUnsignedTransaction;
    txHash: string;
    txRaw: string;
    sendAt: Date;
    isFailed?: boolean;
    err?: string;
    errorType?: ProcessErrorType | null;
    app?: { identity: string; origin?: string; name?: string; icon?: string } | null;
  }): Promise<Tx> {
    const { address, unsignedTx, txHash, txRaw, sendAt, isFailed = false, err, errorType, app = null } = params;

    const payload = unsignedTx.payload ?? {};
    const txMethod = resolveTransactionMethod({ payload });
    const network = await address.network.fetch();
    const txApp = await this.resolveTxAppRecord(app);
    const status = await this.resolveInitialTxStatus({
      address,
      network,
      from: payload.from ?? null,
      nonce: typeof payload.nonce === 'number' ? payload.nonce : null,
      isFailed,
    });
    const updated = await this.reuseTxByRaw({
      address,
      txRaw,
      pendingPayload: payload,
      txHash,
      status,
      sendAt,
      err: err ?? null,
      errorType: errorType ?? null,
      source: TxSource.DAPP,
      method: txMethod,
      appRecord: txApp.appRecord,
      preparedApp: txApp.preparedApp,
    });
    if (updated) {
      return updated;
    }

    const txPayload = this.database.get<TxPayload>(TableName.TxPayload).prepareCreate((record) => {
      record.type = payload.type != null ? String(payload.type) : null;
      record.accessList = null;
      record.maxFeePerGas = payload.maxFeePerGas ?? null;
      record.maxPriorityFeePerGas = payload.maxPriorityFeePerGas ?? null;
      record.from = payload.from ?? null;
      record.to = payload.to ?? null;
      record.gasPrice = payload.gasPrice ?? null;
      record.gasLimit = payload.gasLimit ?? (payload.gas as string | undefined) ?? null;
      record.storageLimit = payload.storageLimit ?? null;
      record.data = payload.data ?? null;
      record.value = payload.value ?? null;
      record.nonce = typeof payload.nonce === 'number' ? payload.nonce : null;
      record.chainId = payload.chainId ?? null;
      record.epochHeight = payload.epochHeight != null ? String(payload.epochHeight) : null;
    });

    const txExtra = this.database.get<TxExtra>(TableName.TxExtra).prepareCreate((record) => {
      record.ok = true;
      record.simple = false;
      record.contractInteraction = true;
      record.token20 = false;
      record.tokenNft = false;
      record.sendAction = null;
      record.address = payload.to ?? null;
      record.method = null;
      record.contractCreation = !payload.to && !!payload.data;
    });

    const tx = this.database.get<Tx>(TableName.Tx).prepareCreate((record) => {
      record.raw = txRaw;
      record.hash = txHash;
      record.status = status;
      record.executedStatus = null;
      record.receipt = null;
      record.executedAt = null;
      record.errorType = errorType ?? null;
      record.err = err ?? null;
      record.sendAt = sendAt;
      record.resendAt = null;
      record.resendCount = null;
      record.isTempReplacedByInner = null;
      record.source = TxSource.DAPP;
      record.method = txMethod;
      record.address.set(address);
      record.txPayload.set(txPayload);
      record.txExtra.set(txExtra);
      if (txApp.appRecord) {
        record.app.set(txApp.appRecord);
      }
    });

    await this.database.write(async () => {
      await this.database.batch(...(txApp.preparedApp ? [txApp.preparedApp] : []), txPayload, txExtra, tx);
    });

    return tx;
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

  private createRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private toHardwareOperationError(error: unknown): HardwareOperationError {
    const message = error instanceof Error ? error.message : String(error);

    const codeCandidate = (error as { code?: unknown } | null)?.code;
    const code = typeof codeCandidate === 'string' && codeCandidate.trim() !== '' ? codeCandidate : 'UNKNOWN';

    const detailsCandidate = (error as { details?: unknown } | null)?.details;
    const details =
      detailsCandidate && typeof detailsCandidate === 'object' && !Array.isArray(detailsCandidate) ? (detailsCandidate as Record<string, unknown>) : undefined;

    const reasonCandidate = details?.reason;
    const reason = typeof reasonCandidate === 'string' ? reasonCandidate : undefined;

    return { code, message, reason, details };
  }

  private toLowerCaseAddress(value?: string | null): string | null {
    return value ? value.toLowerCase() : null;
  }

  private getPendingCountLimit(): number {
    const limit = Math.floor(this.config?.wallet?.pendingCountLimit ?? 5);
    return Number.isFinite(limit) && limit > 0 ? limit : 5;
  }

  private toHex(value: bigint): Hex {
    return OxHex.fromNumber(value) as Hex;
  }

  private toBigInt(value: Hex): bigint {
    return OxHex.toBigInt(value as OxHex.Hex);
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
        const clamped = this.clampGasPrice(this.toHex(scaled), params.network);
        const gasCost = this.toHex(this.toBigInt(clamped) * gasLimit);
        return [level, { maxFeePerGas: clamped, maxPriorityFeePerGas: clamped, gasCost }];
      }),
    ) as Record<GasLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }>;
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

  private assertReplacementFeeBumped(params: {
    is1559: boolean;
    origin: { gasPrice: string | null; maxFeePerGas: string | null; maxPriorityFeePerGas: string | null };
    next: SpeedUpTxInput['feeOverrides'];
  }): void {
    const { is1559, origin, next } = params;

    const toBigIntOrNull = (v: string | null | undefined) => {
      if (!v) return null;
      try {
        return BigInt(v);
      } catch {
        return null;
      }
    };

    if (is1559) {
      if (!('maxFeePerGas' in next) || !('maxPriorityFeePerGas' in next)) {
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Replacement transaction requires EIP-1559 fee fields.',
          context: { originMaxFeePerGas: origin.maxFeePerGas, originMaxPriorityFeePerGas: origin.maxPriorityFeePerGas },
        });
      }
      const originMax = toBigIntOrNull(origin.maxFeePerGas);
      const originTip = toBigIntOrNull(origin.maxPriorityFeePerGas);
      const nextMax = toBigIntOrNull(next.maxFeePerGas);
      const nextTip = toBigIntOrNull(next.maxPriorityFeePerGas);

      if (originMax !== null && nextMax !== null && nextMax <= originMax) {
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Replacement transaction maxFeePerGas is not bumped.',
          context: { originMaxFeePerGas: origin.maxFeePerGas, maxFeePerGas: next.maxFeePerGas },
        });
      }
      if (originTip !== null && nextTip !== null && nextTip < originTip) {
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Replacement transaction maxPriorityFeePerGas is not bumped.',
          context: { originMaxPriorityFeePerGas: origin.maxPriorityFeePerGas, maxPriorityFeePerGas: next.maxPriorityFeePerGas },
        });
      }
      return;
    }

    if (!('gasPrice' in next)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction requires legacy gasPrice.',
        context: { originGasPrice: origin.gasPrice },
      });
    }

    const originGasPrice = toBigIntOrNull(origin.gasPrice);
    const nextGasPrice = toBigIntOrNull(next.gasPrice);

    if (originGasPrice !== null && nextGasPrice !== null && nextGasPrice <= originGasPrice) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction gasPrice is not bumped.',
        context: { originGasPrice: origin.gasPrice, gasPrice: next.gasPrice },
      });
    }
  }

  private async buildReplacementPayload(params: {
    network: Network;
    from: string;
    origin: TxPayload;
    action: SpeedUpAction;
    feeOverrides: SpeedUpTxInput['feeOverrides'];
    gasLimit?: string;
    storageLimit?: string;
    nonce: number;
    chainProvider: IChainProvider;
  }): Promise<UnsignedTransaction> {
    const { network, from, origin, action, feeOverrides, gasLimit, storageLimit, nonce, chainProvider } = params;

    const to = action === SPEED_UP_ACTION.Cancel ? from : (origin.to ?? undefined);
    const value: Hex = action === SPEED_UP_ACTION.Cancel ? '0x0' : ((origin.value ?? '0x0') as Hex);
    const data: Hex = action === SPEED_UP_ACTION.Cancel ? '0x' : ((origin.data ?? '0x') as Hex);

    if (network.networkType === NetworkType.Ethereum) {
      const is1559 = 'maxFeePerGas' in feeOverrides;
      return {
        chainType: NetworkType.Ethereum,
        payload: {
          from,
          to,
          chainId: network.chainId,
          value,
          data,
          gasLimit,
          nonce,
          type: is1559 ? 2 : 0,
          ...(is1559
            ? { maxFeePerGas: feeOverrides.maxFeePerGas, maxPriorityFeePerGas: feeOverrides.maxPriorityFeePerGas }
            : { gasPrice: feeOverrides.gasPrice }),
        },
      };
    }

    if (network.networkType === NetworkType.Conflux) {
      if (!('gasPrice' in feeOverrides)) {
        throw new CoreError({
          code: TX_INVALID_PARAMS,
          message: 'Conflux replacement tx requires legacy gasPrice.',
          context: { networkType: network.networkType, chainId: network.chainId },
        });
      }

      // Use latest epochHeight for replacement to avoid stale epochHeight rejection.
      // Conflux RPC returns hex quantity; coerce to a safe integer.
      const epochNumberHex = await chainProvider.rpc.request<string>('cfx_epochNumber', ['latest_state']);
      const epochBigInt = epochNumberHex.startsWith('0x') ? BigInt(epochNumberHex) : BigInt(epochNumberHex);
      const epochHeight = Number(epochBigInt);
      if (!Number.isFinite(epochHeight)) {
        throw new Error('Invalid Conflux epochHeight.');
      }

      return {
        chainType: NetworkType.Conflux,
        payload: {
          from,
          to,
          chainId: network.chainId,
          value,
          data,
          gasLimit,
          storageLimit,
          nonce,
          gasPrice: feeOverrides.gasPrice,
          epochHeight,
        },
      };
    }

    throw new Error(`buildReplacementPayload: unsupported networkType: ${String(network.networkType)}`);
  }

  private async isWaitingLike(chainProvider: IChainProvider, from: string, txNonce: number): Promise<boolean> {
    const nextNonce = await chainProvider.getNonce(from);
    return nextNonce < txNonce;
  }

  private async resolveInitialTxStatus(params: {
    address: Address;
    network: Network;
    from: string | null;
    nonce: number | null;
    isFailed: boolean;
  }): Promise<DbTxStatus> {
    const { address, network, from, nonce, isFailed } = params;
    if (isFailed) {
      return DbTxStatus.SEND_FAILED;
    }

    if (typeof nonce !== 'number') {
      return DbTxStatus.PENDING;
    }

    const chainProvider = this.getChainProvider(network);
    const fromValue = from ?? (await address.getValue());
    const waiting = await this.isWaitingLike(chainProvider, fromValue, nonce);
    return waiting ? DbTxStatus.WAITTING : DbTxStatus.PENDING;
  }

  private async reuseTxByRaw(params: {
    address: Address;
    txRaw: string;
    pendingPayload: any;
    txHash: string;
    status: DbTxStatus;
    sendAt: Date;
    err: string | null;
    errorType: ProcessErrorType | null;
    source: TxSource;
    method: string;
    appRecord?: App | null;
    preparedApp?: App | null;
  }): Promise<Tx | null> {
    const existingTx = await this.findTxByRawAndPayload(params.address.id, params.txRaw, params.pendingPayload);
    if (!existingTx) {
      return null;
    }

    if (existingTx.status !== DbTxStatus.SEND_FAILED) {
      return existingTx;
    }

    await this.database.write(async () => {
      const ops: Array<Tx | App> = [];
      if (params.preparedApp) {
        ops.push(params.preparedApp);
      }

      ops.push(
        existingTx.prepareUpdate((record) => {
          record.raw = params.txRaw;
          record.hash = params.txHash;
          record.status = params.status;
          record.executedStatus = null;
          record.receipt = null;
          record.executedAt = null;
          record.errorType = params.errorType;
          record.err = params.err;
          record.sendAt = params.sendAt;
          record.resendAt = null;
          record.resendCount = null;
          record.isTempReplacedByInner = null;
          record.source = params.source;
          record.method = params.method;
          record.app.id = params.appRecord?.id;
        }),
      );

      await this.database.batch(...ops);
    });

    return existingTx;
  }

  private async resolveTxAppRecord(
    input: { identity: string; origin?: string; name?: string; icon?: string } | null,
  ): Promise<{ appRecord: App | null; preparedApp: App | null }> {
    if (!input?.identity) {
      return { appRecord: null, preparedApp: null };
    }

    const existingApp = await this.findAppByIdentity(input.identity);
    if (existingApp) {
      return { appRecord: existingApp, preparedApp: null };
    }

    const preparedApp = this.database.get<App>(TableName.App).prepareCreate((record) => {
      record.identity = input.identity;
      record.origin = input.origin;
      record.name = input.name ?? input.identity;
      record.icon = input.icon;
    });

    return { appRecord: preparedApp, preparedApp };
  }

  private async findAppByIdentity(identity: string): Promise<App | null> {
    if (!identity) {
      return null;
    }

    const rows = await this.database.get<App>(TableName.App).query(Q.where('identity', identity)).fetch();
    return rows[0] ?? null;
  }

  private async findTxByRawAndPayload(addressId: string, txRaw: string, pendingPayload: any): Promise<Tx | null> {
    if (!txRaw) {
      return null;
    }

    const rows = await this.database
      .get<Tx>(TableName.Tx)
      .query(Q.where('address_id', addressId), Q.where('is_temp_replaced', Q.notEq(true)), Q.where('raw', txRaw))
      .fetch();

    if (rows.length === 0) {
      return null;
    }

    const storedPayloads = await Promise.all(rows.map((tx) => tx.txPayload.fetch()));
    const matchedRows = rows.filter((tx, index) => this.hasEquivalentStoredPayload(storedPayloads[index], pendingPayload));
    if (matchedRows.length === 0) {
      return null;
    }

    matchedRows.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    return matchedRows.find((tx) => tx.status !== DbTxStatus.SEND_FAILED) ?? matchedRows[0];
  }

  private hasEquivalentStoredPayload(storedPayload: TxPayload, pendingPayload: any): boolean {
    const payloadIdentityText = (value: unknown) => (value == null ? null : String(value));
    const payloadIdentityNonce = (value: unknown) => (typeof value === 'number' ? value : null);

    return (
      payloadIdentityText(storedPayload.from) === payloadIdentityText(pendingPayload.from) &&
      payloadIdentityText(storedPayload.to) === payloadIdentityText(pendingPayload.to) &&
      payloadIdentityText(storedPayload.data) === payloadIdentityText(pendingPayload.data) &&
      payloadIdentityText(storedPayload.value) === payloadIdentityText(pendingPayload.value) &&
      payloadIdentityNonce(storedPayload.nonce) === payloadIdentityNonce(pendingPayload.nonce) &&
      payloadIdentityText(storedPayload.chainId) === payloadIdentityText(pendingPayload.chainId)
    );
  }

  private async saveReplacementTx(params: {
    originTx: Tx;
    address: Address;
    unsignedTx: UnsignedTransaction;
    txHash: string;
    txRaw: string;
    sendAt: Date;
    sendAction: SpeedUpAction;
    hideOriginAsTempReplaced: boolean;
    isFailed: boolean;
    err: string | null;
    errorType: ProcessErrorType | null;
  }): Promise<Tx> {
    const { originTx, address, unsignedTx, txHash, txRaw, sendAt, sendAction, hideOriginAsTempReplaced, isFailed, err, errorType } = params;

    const originExtra = await originTx.txExtra.fetch();
    const originAsset = await originTx.asset.fetch().catch(() => null);
    const originApp = await originTx.app.fetch().catch(() => null);
    const network = await address.network.fetch();
    if (!network) throw new Error('[TransactionService] Address has no associated network.');

    const payload: any = unsignedTx.payload ?? {};
    const assets = await network.assets.fetch();
    const nativeAsset = assets.find((item) => item.type === AssetType.Native);

    const txPayload = this.database.get<TxPayload>(TableName.TxPayload).prepareCreate((record) => {
      record.type = payload.type != null ? String(payload.type) : null;
      record.accessList = null;
      record.maxFeePerGas = payload.maxFeePerGas ?? null;
      record.maxPriorityFeePerGas = payload.maxPriorityFeePerGas ?? null;
      record.from = payload.from ?? null;
      record.to = payload.to ?? null;
      record.gasPrice = payload.gasPrice ?? null;
      record.gasLimit = payload.gasLimit ?? (payload.gas as string | undefined) ?? null;
      record.storageLimit = payload.storageLimit ?? null;
      record.data = payload.data ?? null;
      record.value = payload.value ?? null;
      record.nonce = typeof payload.nonce === 'number' ? payload.nonce : null;
      record.chainId = payload.chainId ?? null;
      record.epochHeight = payload.epochHeight != null ? String(payload.epochHeight) : null;
    });

    const txExtra = this.database.get<TxExtra>(TableName.TxExtra).prepareCreate((record) => {
      const assetType = sendAction === SPEED_UP_ACTION.Cancel ? AssetType.Native : ((originAsset?.type as unknown as AssetType | undefined) ?? null);

      // When origin asset is missing (e.g. legacy records / dApp tx), preserve existing extra flags.
      if (sendAction !== SPEED_UP_ACTION.Cancel && assetType === null) {
        record.ok = originExtra.ok;
        record.simple = originExtra.simple;
        record.contractInteraction = originExtra.contractInteraction;
        record.token20 = originExtra.token20;
        record.tokenNft = originExtra.tokenNft;
        record.address = originExtra.address;
        record.method = originExtra.method;
        record.contractCreation = originExtra.contractCreation;
      } else {
        record.ok = true;
        record.simple = assetType === AssetType.Native;
        record.contractInteraction = assetType !== AssetType.Native;
        record.token20 = assetType === AssetType.ERC20;
        record.tokenNft = assetType === AssetType.ERC721 || assetType === AssetType.ERC1155;
        record.address = payload.to ?? null;
        record.method = assetType === AssetType.ERC20 ? 'transfer' : null;
        record.contractCreation = !payload.to && !!payload.data;
      }

      record.sendAction = sendAction;
    });

    const chainProvider = this.getChainProvider(network);
    const waiting =
      typeof payload.nonce === 'number' ? await this.isWaitingLike(chainProvider, payload.from ?? (await address.getValue()), payload.nonce) : false;

    const tx = this.database.get<Tx>(TableName.Tx).prepareCreate((record) => {
      record.raw = txRaw;
      record.hash = txHash;
      record.status = isFailed ? DbTxStatus.SEND_FAILED : waiting ? DbTxStatus.WAITTING : DbTxStatus.PENDING;
      record.executedStatus = null;
      record.receipt = null;
      record.executedAt = null;
      record.errorType = errorType ?? null;
      record.err = err ?? null;
      record.sendAt = sendAt;
      record.resendAt = null;
      record.resendCount = null;
      record.isTempReplacedByInner = null;
      record.address.set(address);
      record.txPayload.set(txPayload);
      record.txExtra.set(txExtra);

      if (sendAction === SPEED_UP_ACTION.Cancel) {
        record.source = TxSource.SELF;
        record.method = 'transfer';
        if (nativeAsset) record.asset.set(nativeAsset);
      } else {
        record.source = originTx.source;
        record.method = originTx.method;
        if (originApp) record.app.set(originApp);
        if (originAsset) record.asset.set(originAsset);
      }
    });

    await this.database.write(async () => {
      const ops: any[] = [txPayload, txExtra, tx];

      if (hideOriginAsTempReplaced) {
        ops.push(
          originTx.prepareUpdate((record) => {
            record.status = DbTxStatus.TEMP_REPLACED;
            record.isTempReplacedByInner = true;
            record.raw = null;
            record.executedStatus = null;
            record.receipt = null;
            record.executedAt = null;
            record.err = null;
            record.errorType = ProcessErrorType.replacedByAnotherTx;
          }),
        );
      }

      await this.database.batch(...ops);
    });

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
