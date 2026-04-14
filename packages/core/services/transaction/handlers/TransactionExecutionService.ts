import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { App } from '@core/database/models/App';
import type { Asset } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError, TX_BROADCAST_FAILED, TX_SAVE_FAILED } from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { SignatureRecordService } from '@core/services/signing/SignatureRecordService';
import { SigningService } from '@core/services/signing/SigningService';
import {
  AssetType,
  type EvmUnsignedTransaction,
  type HardwareOperationError,
  type IChainProvider,
  SPEED_UP_ACTION,
  type SpeedUpAction,
  type UnsignedTransaction,
} from '@core/types';
import { ProcessErrorType } from '@core/utils/eth';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import { resolveTransactionMethod } from '../methodResolver';

type SignatureAppInput = {
  identity: string;
  origin?: string;
  name?: string;
  icon?: string;
} | null;

@injectable()
export class TransactionExecutionService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  @inject(SigningService)
  private readonly signingService!: SigningService;

  @inject(SignatureRecordService)
  private readonly signatureRecordService!: SignatureRecordService;

  @inject(CORE_IDENTIFIERS.EVENT_BUS)
  @optional()
  private readonly eventBus?: EventBus<CoreEventMap>;

  async executeSelfTransaction(params: {
    address: Address;
    network: Network;
    unsignedTx: UnsignedTransaction;
    assetType: AssetType;
    contractAddress?: string;
    signal?: AbortSignal;
  }): Promise<Tx> {
    return this.executeSignedTransaction({
      address: params.address,
      network: params.network,
      unsignedTx: params.unsignedTx,
      signal: params.signal,
      persistSuccess: ({ txHash, txRaw, sendAt }) =>
        this.saveTx({
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash,
          txRaw,
          assetType: params.assetType,
          contractAddress: params.contractAddress,
          sendAt,
        }),
      persistFailure: ({ txRaw, sendAt, message }) =>
        this.saveTx({
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash: '',
          txRaw,
          assetType: params.assetType,
          contractAddress: params.contractAddress,
          sendAt,
          isFailed: true,
          err: message,
          errorType: null,
        }),
    });
  }

  async executeDappTransaction(params: {
    address: Address;
    network: Network;
    unsignedTx: EvmUnsignedTransaction;
    app?: SignatureAppInput;
    signal?: AbortSignal;
  }): Promise<Tx> {
    return this.executeSignedTransaction({
      address: params.address,
      network: params.network,
      unsignedTx: params.unsignedTx,
      signal: params.signal,
      signatureApp: params.app ?? null,
      persistSuccess: ({ txHash, txRaw, sendAt }) =>
        this.saveDappTx({
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash,
          txRaw,
          sendAt,
          app: params.app ?? null,
        }),
      persistFailure: ({ txRaw, sendAt, message }) =>
        this.saveDappTx({
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash: '',
          txRaw,
          sendAt,
          isFailed: true,
          err: message,
          errorType: null,
          app: params.app ?? null,
        }),
    });
  }

  async executeReplacementTransaction(params: {
    originTx: Tx;
    address: Address;
    network: Network;
    unsignedTx: UnsignedTransaction;
    sendAction: SpeedUpAction;
    hideOriginAsTempReplaced: boolean;
    signal?: AbortSignal;
  }): Promise<Tx> {
    return this.executeSignedTransaction({
      address: params.address,
      network: params.network,
      unsignedTx: params.unsignedTx,
      signal: params.signal,
      persistSuccess: ({ txHash, txRaw, sendAt }) =>
        this.saveReplacementTx({
          originTx: params.originTx,
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash,
          txRaw,
          sendAt,
          sendAction: params.sendAction,
          hideOriginAsTempReplaced: params.hideOriginAsTempReplaced,
          isFailed: false,
          err: null,
          errorType: null,
        }),
      persistFailure: ({ txRaw, sendAt, message }) =>
        this.saveReplacementTx({
          originTx: params.originTx,
          address: params.address,
          network: params.network,
          unsignedTx: params.unsignedTx,
          txHash: '',
          txRaw,
          sendAt,
          sendAction: params.sendAction,
          hideOriginAsTempReplaced: false,
          isFailed: true,
          err: message,
          errorType: null,
        }),
    });
  }

  private async executeSignedTransaction(params: {
    address: Address;
    network: Network;
    unsignedTx: UnsignedTransaction;
    signal?: AbortSignal;
    signatureApp?: SignatureAppInput;
    persistSuccess: (input: { txHash: string; txRaw: string; sendAt: Date }) => Promise<Tx>;
    persistFailure: (input: { txRaw: string; sendAt: Date; message: string }) => Promise<Tx>;
  }): Promise<Tx> {
    const { signedTx, signatureId } = await this.signTransaction({
      address: params.address,
      network: params.network,
      unsignedTx: params.unsignedTx,
      signal: params.signal,
      signatureApp: params.signatureApp ?? null,
    });

    const chainProvider = this.getChainProvider(params.network);
    const sendAt = new Date();
    let txHash: string;

    try {
      txHash = await chainProvider.broadcastTransaction(signedTx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        const tx = await params.persistFailure({
          txRaw: signedTx.rawTransaction,
          sendAt,
          message,
        });

        await this.linkSignatureRecord(signatureId, tx.id);

        this.emitTxCreated({
          addressId: params.address.id,
          networkId: params.network.id,
          txId: tx.id,
        });
      } catch {
        // Keep the original broadcast failure as the primary error.
      }

      if (error instanceof CoreError) {
        throw error;
      }

      throw new CoreError({
        code: TX_BROADCAST_FAILED,
        message: 'Failed to broadcast transaction.',
        cause: error,
        context: { chainId: params.network.chainId, networkType: params.network.networkType },
      });
    }

    let tx: Tx;
    try {
      tx = await params.persistSuccess({
        txHash,
        txRaw: signedTx.rawTransaction,
        sendAt,
      });
    } catch (error) {
      if (error instanceof CoreError) {
        throw error;
      }

      throw new CoreError({
        code: TX_SAVE_FAILED,
        message: 'Transaction was broadcast but failed to persist locally.',
        cause: error,
        context: { chainId: params.network.chainId, networkType: params.network.networkType, txHash },
      });
    }

    await this.linkSignatureRecord(signatureId, tx.id);

    this.emitTxCreated({
      addressId: params.address.id,
      networkId: params.network.id,
      txId: tx.id,
    });

    return tx;
  }

  private async signTransaction(params: {
    address: Address;
    network: Network;
    unsignedTx: UnsignedTransaction;
    signal?: AbortSignal;
    signatureApp?: SignatureAppInput;
  }): Promise<{
    signedTx: Awaited<ReturnType<IChainProvider['signTransaction']>>;
    signatureId: string | null;
  }> {
    const account = await params.address.account.fetch();
    const signer = await this.signingService.getSigner(account.id, params.address.id, {
      signal: params.signal,
    });

    const requestId = this.createRequestId();
    const chainProvider = this.getChainProvider(params.network);

    let signedTx: Awaited<ReturnType<IChainProvider['signTransaction']>>;

    try {
      if (signer.type === 'hardware') {
        this.eventBus?.emit('hardware-sign/started', {
          requestId,
          accountId: account.id,
          addressId: params.address.id,
          networkId: params.network.id,
        });
      }

      signedTx = await chainProvider.signTransaction(params.unsignedTx, signer, {
        signal: params.signal,
      });

      if (signer.type === 'hardware') {
        this.eventBus?.emit('hardware-sign/succeeded', {
          requestId,
          accountId: account.id,
          addressId: params.address.id,
          networkId: params.network.id,
          txHash: signedTx.hash,
          rawTransaction: signedTx.rawTransaction,
        });
      }
    } catch (error) {
      if (signer.type === 'hardware') {
        if (params.signal?.aborted) {
          this.eventBus?.emit('hardware-sign/aborted', {
            requestId,
            accountId: account.id,
            addressId: params.address.id,
            networkId: params.network.id,
          });
        } else {
          this.eventBus?.emit('hardware-sign/failed', {
            requestId,
            accountId: account.id,
            addressId: params.address.id,
            networkId: params.network.id,
            error: this.toHardwareOperationError(error),
          });
        }
      }

      throw error;
    }

    let signatureId: string | null = null;
    try {
      signatureId = await this.signatureRecordService.createRecord({
        addressId: params.address.id,
        signType: SignType.TX,
        ...(params.signatureApp ? { app: params.signatureApp } : null),
      });
    } catch {
      signatureId = null;
    }

    return { signedTx, signatureId };
  }

  private async linkSignatureRecord(signatureId: string | null, txId: string): Promise<void> {
    if (!signatureId) {
      return;
    }

    await this.signatureRecordService.linkTx({ signatureId, txId });
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

  private emitTxCreated(params: { addressId: string; networkId: string; txId: string }): void {
    this.eventBus?.emit('tx/created', {
      key: { addressId: params.addressId, networkId: params.networkId },
      txId: params.txId,
    });
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

  private async saveTx(params: {
    address: Address;
    network: Network;
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
    const { address, network, unsignedTx, txHash, txRaw, assetType, contractAddress, sendAt, isFailed = false, err, errorType } = params;

    const payload: any = unsignedTx.payload ?? {};
    const txMethod = resolveTransactionMethod({ payload, assetType });

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
    network: Network;
    unsignedTx: EvmUnsignedTransaction;
    txHash: string;
    txRaw: string;
    sendAt: Date;
    isFailed?: boolean;
    err?: string;
    errorType?: ProcessErrorType | null;
    app?: SignatureAppInput;
  }): Promise<Tx> {
    const { address, network, unsignedTx, txHash, txRaw, sendAt, isFailed = false, err, errorType, app = null } = params;

    const payload: any = unsignedTx.payload ?? {};
    const txMethod = resolveTransactionMethod({ payload });
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

  private async saveReplacementTx(params: {
    originTx: Tx;
    address: Address;
    network: Network;
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
    const { originTx, address, network, unsignedTx, txHash, txRaw, sendAt, sendAction, hideOriginAsTempReplaced, isFailed, err, errorType } = params;

    const originExtra = await originTx.txExtra.fetch();
    const originAsset = await originTx.asset.fetch().catch(() => null);
    const originApp = await originTx.app.fetch().catch(() => null);

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
        if (nativeAsset) {
          record.asset.set(nativeAsset);
        }
      } else {
        record.source = originTx.source;
        record.method = originTx.method;
        if (originApp) {
          record.app.set(originApp);
        }
        if (originAsset) {
          record.asset.set(originAsset);
        }
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

  private async resolveTxAppRecord(input: SignatureAppInput): Promise<{ appRecord: App | null; preparedApp: App | null }> {
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
}
