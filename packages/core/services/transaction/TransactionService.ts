import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, FINISHED_IN_ACTIVITY_TX_STATUSES, PENDING_COUNT_STATUSES, PENDING_TX_STATUSES, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import VaultType from '@core/database/models/Vault/VaultType';
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
  AssetType,
  type ChainType,
  type EvmUnsignedTransaction,
  type FeeEstimate,
  type HardwareOperationError,
  type Hex,
  type IChainProvider,
  NetworkType,
  TxStatus as ServiceTxStatus,
  type SpeedUpAction,
  type TransactionParams,
  type UnsignedTransaction,
} from '@core/types';
import { Networks } from '@core/utils/consts';
import type { ProcessErrorType } from '@core/utils/eth';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import * as OxHex from 'ox/Hex';
import * as OxValue from 'ox/Value';
import type { EvmRpcTransactionRequest } from './dappTypes';
import type {
  GasPricingEstimate,
  ITransaction,
  LegacyLikeGasEstimate,
  RecentlyAddress,
  SendERC20Input,
  SendTransactionInput,
  SpeedUpTxContext,
  SpeedUpTxInput,
  TransactionFilter,
} from './types';

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
    const unsignedTx = await chainProvider.buildTransaction(txParams);

    // estimate fee (currently the returned value is not used)
    await chainProvider.estimateFee(unsignedTx);

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

      throw error;
    }
    this.eventBus?.emit('tx/created', { key: { addressId: address.id, networkId: network.id }, txId: tx.id });
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

    const chainProvider = this.getChainProvider(network);
    const unsignedTx = await this.buildEvmUnsignedTxFromRpc({ chainProvider, network, request: input.request });

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

  async sendDappTransaction(input: { addressId: string; request: EvmRpcTransactionRequest; signal?: AbortSignal }): Promise<ITransaction> {
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

    const chainProvider = this.getChainProvider(network);

    let unsignedTx: EvmUnsignedTransaction;
    try {
      unsignedTx = await this.buildEvmUnsignedTxFromRpc({ chainProvider, network, request: input.request });
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_BUILD_FAILED,
        message: 'Failed to build dApp transaction.',
        cause: error,
        context: { chainId: network.chainId },
      });
    }

    let estimate: FeeEstimate | undefined;
    try {
      estimate = await chainProvider.estimateFee(unsignedTx);
      if (!unsignedTx.payload.gasLimit) {
        unsignedTx.payload.gasLimit = estimate.gasLimit;
      }
      if (!unsignedTx.payload.gasPrice && estimate.chainType === NetworkType.Ethereum && 'gasPrice' in estimate && estimate.gasPrice) {
        unsignedTx.payload.gasPrice = estimate.gasPrice;
      }
      if (estimate.chainType === NetworkType.Ethereum && 'maxFeePerGas' in estimate && estimate.maxFeePerGas && !unsignedTx.payload.maxFeePerGas) {
        unsignedTx.payload.maxFeePerGas = estimate.maxFeePerGas;
      }
      if (
        estimate.chainType === NetworkType.Ethereum &&
        'maxPriorityFeePerGas' in estimate &&
        estimate.maxPriorityFeePerGas &&
        !unsignedTx.payload.maxPriorityFeePerGas
      ) {
        unsignedTx.payload.maxPriorityFeePerGas = estimate.maxPriorityFeePerGas;
      }
      if (unsignedTx.payload.type == null) {
        if (unsignedTx.payload.maxFeePerGas || unsignedTx.payload.maxPriorityFeePerGas) unsignedTx.payload.type = 2;
        else if (unsignedTx.payload.gasPrice) unsignedTx.payload.type = 0;
      }
    } catch (error) {
      if (error instanceof CoreError) throw error;
      throw new CoreError({
        code: TX_ESTIMATE_FAILED,
        message: 'Failed to estimate dApp transaction fee.',
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
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
      }

      this.eventBus?.emit('tx/created', { key: { addressId: address.id, networkId: network.id }, txId: tx.id });
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
        });

        if (signatureId) {
          await this.signatureRecordService.linkTx({ signatureId, txId: tx.id });
        }
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
      status: this.mapStatus(tx.status),
      sendAction: extra.sendAction ?? null,
      assetType,
      payload: {
        from: payload.from ?? '',
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

    const effectiveAction: SpeedUpAction = extra.sendAction === 'Cancel' ? 'Cancel' : input.action;

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
        isFailed: false,
        err: null,
        errorType: null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: newTx.id });
      }

      this.eventBus?.emit('tx/created', { key: { addressId: address.id, networkId: network.id }, txId: newTx.id });
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
        isFailed: true,
        err: message,
        errorType: null,
      });

      if (signatureId) {
        await this.signatureRecordService.linkTx({ signatureId, txId: failed.id });
      }

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

  private getChainProvider(network: Network): IChainProvider {
    const provider = this.chainRegistry.get(network.chainId, network.networkType);
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
  private parseHexQuantityToNumber(value?: string): number | undefined {
    if (!value) return undefined;
    const asBigInt = BigInt(value);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Invalid JSON-RPC params.',
        context: { reason: 'nonce/type exceeds Number.MAX_SAFE_INTEGER.' },
      });
    }
    return Number(asBigInt);
  }

  private async buildEvmUnsignedTxFromRpc(params: {
    chainProvider: IChainProvider;
    network: Network;
    request: EvmRpcTransactionRequest;
  }): Promise<EvmUnsignedTransaction> {
    const { chainProvider, network, request } = params;

    const nonce = request.nonce ? this.parseHexQuantityToNumber(request.nonce) : await chainProvider.getNonce(request.from);
    const type = request.type ? this.parseHexQuantityToNumber(request.type) : undefined;

    return {
      chainType: NetworkType.Ethereum,
      payload: {
        from: request.from,
        to: request.to,
        chainId: network.chainId,
        data: request.data ?? '0x',
        value: request.value ?? '0x0',
        gasLimit: request.gas,
        gasPrice: request.gasPrice,
        maxFeePerGas: request.maxFeePerGas,
        maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        nonce,
        type,
      },
    };
  }

  private mapStatus(status: DbTxStatus): ServiceTxStatus {
    switch (status) {
      case DbTxStatus.EXECUTED:
      case DbTxStatus.CONFIRMED:
      case DbTxStatus.FINALIZED:
        return ServiceTxStatus.Confirmed;
      case DbTxStatus.REPLACED:
      case DbTxStatus.TEMP_REPLACED:
      case DbTxStatus.SEND_FAILED:
        return ServiceTxStatus.Failed;
      case DbTxStatus.WAITTING:
      case DbTxStatus.DISCARDED:
      case DbTxStatus.PENDING:
      default:
        return ServiceTxStatus.Pending;
    }
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

    const network = await address.network.fetch();

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
      record.status = isFailed ? DbTxStatus.SEND_FAILED : DbTxStatus.PENDING;
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
      record.method = assetType === AssetType.ERC20 ? 'transfer' : '';
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
  }): Promise<Tx> {
    const { address, unsignedTx, txHash, txRaw, sendAt, isFailed = false, err, errorType } = params;

    const payload: any = unsignedTx.payload ?? {};

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
      record.status = isFailed ? DbTxStatus.SEND_FAILED : DbTxStatus.PENDING;
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
      record.method = '';
      record.address.set(address);
      record.txPayload.set(txPayload);
      record.txExtra.set(txExtra);
    });

    await this.database.write(async () => {
      await this.database.batch(txPayload, txExtra, tx);
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

  async getTransactionById(txId: string): Promise<ITransaction | null> {
    try {
      const tx = await this.database.get<Tx>(TableName.Tx).find(txId);
      return this.toInterface(tx);
    } catch {
      return null;
    }
  }

  // get recently addresses
  async getRecentlyAddresses(addressId: string, limit = 20): Promise<RecentlyAddress[]> {
    if (limit <= 0) {
      return [];
    }

    const ownerAddress = await this.findAddress(addressId);
    const ownerVariants = await this.buildAddressVariants(ownerAddress);
    const localAddressSet = await this.buildLocalAddressSet();
    const txs = await this.createTxQuery(addressId, 'all').fetch();

    const peers = new Map<string, RecentlyAddress>();
    for (const tx of txs) {
      const payload = await tx.txPayload.fetch();
      const peer = await this.resolvePeerAddress(tx, payload, ownerVariants);
      if (!peer) {
        continue;
      }

      const normalized = peer.valueNormalized;
      const isLocal = localAddressSet.has(normalized);
      const snapshot: RecentlyAddress = {
        addressValue: peer.addressValue,
        direction: peer.direction,
        isLocalAccount: isLocal,
        lastUsedAt: peer.lastUsedAt,
      };

      const existing = peers.get(normalized);
      if (!existing || snapshot.lastUsedAt > existing.lastUsedAt) {
        peers.set(normalized, snapshot);
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
      return [Q.where('status', Q.oneOf(PENDING_TX_STATUSES))];
    }
    if (status === 'finished') {
      return [Q.where('status', Q.oneOf(FINISHED_IN_ACTIVITY_TX_STATUSES))];
    }
    return [Q.where('status', Q.notEq(DbTxStatus.SEND_FAILED))];
  }

  // build address variants
  private async buildAddressVariants(address: Address): Promise<Set<string>> {
    const variants = new Set<string>();
    const networkValue = await address.getValue();
    variants.add(networkValue.toLowerCase());
    variants.add(address.hex.toLowerCase());
    variants.add(address.base32.toLowerCase());
    return variants;
  }

  // build local address set
  private async buildLocalAddressSet(): Promise<Set<string>> {
    const addresses = await this.database.get<Address>(TableName.Address).query().fetch();
    const values = new Set<string>();
    for (const item of addresses) {
      if (item.hex) values.add(item.hex.toLowerCase());
      if (item.base32) values.add(item.base32.toLowerCase());
    }
    return values;
  }

  // get peer address by tx
  private async resolvePeerAddress(
    tx: Tx,
    payload: TxPayload,
    ownerVariants: Set<string>,
  ): Promise<{ addressValue: string; valueNormalized: string; direction: 'inbound' | 'outbound'; lastUsedAt: number } | null> {
    const lowerCaseFrom = this.toLowerCaseAddress(payload.from);
    const lowerCaseTo = this.toLowerCaseAddress(payload.to);

    if (lowerCaseFrom && ownerVariants.has(lowerCaseFrom)) {
      const peerValue = payload.to ?? null;
      if (!peerValue) return null;
      return {
        addressValue: peerValue,
        valueNormalized: peerValue.toLowerCase(),
        direction: 'outbound',
        lastUsedAt: tx.sendAt?.getTime() ?? tx.createdAt.getTime(),
      };
    }

    if (lowerCaseTo && ownerVariants.has(lowerCaseTo)) {
      const peerValue = payload.from ?? null;
      if (!peerValue) return null;
      return {
        addressValue: peerValue,
        valueNormalized: peerValue.toLowerCase(),
        direction: 'inbound',
        lastUsedAt: tx.sendAt?.getTime() ?? tx.createdAt.getTime(),
      };
    }

    return null;
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

    const to = action === 'Cancel' ? from : (origin.to ?? undefined);
    const value: Hex = action === 'Cancel' ? '0x0' : ((origin.value ?? '0x0') as Hex);
    const data: Hex = action === 'Cancel' ? '0x' : ((origin.data ?? '0x') as Hex);

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

  private async saveReplacementTx(params: {
    originTx: Tx;
    address: Address;
    unsignedTx: UnsignedTransaction;
    txHash: string;
    txRaw: string;
    sendAt: Date;
    sendAction: SpeedUpAction;
    isFailed: boolean;
    err: string | null;
    errorType: ProcessErrorType | null;
  }): Promise<Tx> {
    const { originTx, address, unsignedTx, txHash, txRaw, sendAt, sendAction, isFailed, err, errorType } = params;

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
      const assetType = sendAction === 'Cancel' ? AssetType.Native : ((originAsset?.type as unknown as AssetType | undefined) ?? null);

      // When origin asset is missing (e.g. legacy records / dApp tx), preserve existing extra flags.
      if (sendAction !== 'Cancel' && assetType === null) {
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

      if (sendAction === 'Cancel') {
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
      await this.database.batch(txPayload, txExtra, tx);
    });

    return tx;
  }

  private async toInterface(tx: Tx): Promise<ITransaction> {
    const address = await tx.address.fetch();
    const network = await address.network.fetch();
    const txPayload = await tx.txPayload.fetch();

    return {
      id: tx.id,
      hash: tx.hash ?? '',
      from: txPayload.from ?? '',
      to: txPayload.to ?? '',
      value: txPayload.value ?? '0',
      status: this.mapStatus(tx.status),
      timestamp: tx.createdAt.getTime(),
      networkId: network.id,
    };
  }
}
