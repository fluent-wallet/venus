import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import TableName from '@core/database/TableName';
import { SigningService } from '@core/services/signing';
import { AssetType, type IChainProvider, TxStatus as ServiceTxStatus, type TransactionParams, type UnsignedTransaction } from '@core/types';
import type { ProcessErrorType } from '@core/utils/eth';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';
import type { ITransaction, SendERC20Input, SendTransactionInput } from './types';

@injectable()
export class TransactionService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  @inject(ChainRegistry)
  private readonly chainRegistry!: ChainRegistry;

  @inject(SigningService)
  private readonly signingService!: SigningService;

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
    const signedTx = await chainProvider.signTransaction(unsignedTx, signer);
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

      throw error;
    }

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

  private getChainProvider(network: Network): IChainProvider {
    const provider = this.chainRegistry.get(network.chainId, network.networkType);
    if (!provider) {
      throw new Error(`[TransactionService] Chain ${network.networkType} (${network.chainId}) is not registered in ChainRegistry.`);
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
