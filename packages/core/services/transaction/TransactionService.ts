import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, FINISHED_IN_ACTIVITY_TX_STATUSES, PENDING_TX_STATUSES, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
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
import { SigningService } from '@core/services/signing';
import { SignatureRecordService } from '@core/services/signing/SignatureRecordService';
import {
  AssetType,
  type EvmUnsignedTransaction,
  type FeeEstimate,
  type HardwareOperationError,
  type IChainProvider,
  NetworkType,
  TxStatus as ServiceTxStatus,
  type TransactionParams,
  type UnsignedTransaction,
} from '@core/types';
import type { ProcessErrorType } from '@core/utils/eth';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import type { EvmRpcTransactionRequest } from './dappTypes';
import type { ITransaction, RecentlyAddress, SendERC20Input, SendTransactionInput, TransactionFilter } from './types';

@injectable()
export class TransactionService {
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
    const signer = await this.signingService.getSigner(account.id, address.id);

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
    const signer = await this.signingService.getSigner(account.id, address.id);

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
