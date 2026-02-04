import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { TxSource, TxStatus } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import { inject, injectable } from 'inversify';
import database from '../../database';
import { type Asset, AssetType } from '../../database/models/Asset';
import { createTx as _createTx, queryTxsWithAddress } from '../../database/models/Tx/query';
import { createTxExtra as _createTxExtra } from '../../database/models/TxExtra/query';
import { createTxPayload as _createTxPayload } from '../../database/models/TxPayload/query';
import { type SendTransactionParams, SpeedUpAction, type SpeedUpTransactionParams } from '../Events/broadcastTransactionSubject';
import type { INextNonceTrackerServerInterface } from '../Plugins/NextNonceTracker/server';
import type { ITxEvm } from '../Plugins/Transaction/types';
import { SERVICE_IDENTIFIER } from '../service';

interface createTxPayloadParams {
  tx: SendTransactionParams['tx'];
  address?: Address;
  epochHeight?: string | null;
}

export interface ItxMethodServerInterface {
  createTx(params: SendTransactionParams, prepareCreate: true): Promise<readonly [Tx, TxPayload, TxExtra]>;
  createTx(params: SendTransactionParams): Promise<void>;
  speedUpTx(params: SpeedUpTransactionParams, prepareCreate?: true): Promise<undefined | readonly [Tx, TxPayload, TxExtra]>;
}

@injectable()
export class TxMethod {
  @inject(SERVICE_IDENTIFIER.NEXT_NONCE_TRACKER)
  nextNonceTracker!: INextNonceTrackerServerInterface;

  private async isWaitting(address: Address, txNonce: number | undefined) {
    const nextNonce = await this.nextNonceTracker.getNextNonce(address, true);
    return BigInt(nextNonce) < BigInt(txNonce ?? 0);
  }

  createTx(params: SendTransactionParams, prepareCreate: true): Promise<readonly [Tx, TxPayload, TxExtra]>;
  createTx(params: SendTransactionParams): Promise<void>;
  async createTx(params: SendTransactionParams, prepareCreate?: true) {
    try {
      const { address, tx: txData, extraParams, txRaw, txHash, signature, app } = params;
      const updated = await this.updateTx(params);
      if (updated) return updated;
      const [txPayload, txExtra] = await Promise.all([
        this.createTxPayload(
          {
            tx: txData,
            address,
            epochHeight: extraParams.epochHeight,
          },
          true,
        ),
        this.createTxExtra(
          {
            assetType: extraParams.assetType,
          },
          txData,
          true,
        ),
      ]);
      let asset: Asset | undefined;
      const network = await address.network;
      if (params.extraParams.assetType === AssetType.Native) {
        asset = (await network.assets).find((i) => i.type === AssetType.Native);
      } else if (params.extraParams.contractAddress) {
        asset = await network.queryAssetByAddress(params.extraParams.contractAddress);
      }
      const isWaitting = await this.isWaitting(address, txData.nonce);

      const tx = _createTx(
        {
          address,
          app,
          raw: txRaw,
          hash: txHash,
          status: extraParams.err ? TxStatus.SEND_FAILED : isWaitting ? TxStatus.WAITTING : TxStatus.PENDING,
          sendAt: extraParams.sendAt,
          txPayload,
          txExtra,
          asset,
          err: extraParams.err,
          errorType: extraParams.errorType,
          source: app ? TxSource.DAPP : TxSource.SELF,
          method: extraParams.method,
        },
        true,
      );
      signature?.updateTx(tx);
      if (prepareCreate) return [tx, txPayload, txExtra] as const;
      return database.write(async () => {
        await database.batch(tx, txPayload, txExtra);
      });
    } catch (error) {
      console.error('createTx error: ', error);
    }
  }

  async updateTx(params: SendTransactionParams) {
    const { address, extraParams, txRaw, txHash, signature, app, tx: txData } = params;
    const sameTx = await queryTxsWithAddress(address.id, {
      raw: txRaw,
    });
    if (!sameTx || sameTx.length === 0) {
      // no same tx in db
      return false;
    }
    // hasSuccessTx: already success, skip create/update
    const hasSuccessTx = sameTx.some((tx) => tx.status !== TxStatus.SEND_FAILED);
    const tx = sameTx[0];
    let newTx = tx;
    const isWaitting = await this.isWaitting(address, txData.nonce);
    if (!hasSuccessTx) {
      newTx = await tx.updateSelf((_tx) => {
        _tx.app.id = app?.id;
        _tx.hash = txHash;
        _tx.status = extraParams.err ? TxStatus.SEND_FAILED : isWaitting ? TxStatus.WAITTING : TxStatus.PENDING;
        _tx.sendAt = extraParams.sendAt;
        _tx.err = extraParams.err;
        _tx.errorType = extraParams.errorType;
        _tx.source = app ? TxSource.DAPP : TxSource.SELF;
        _tx.method = extraParams.method;
      });
    }
    signature?.updateTx(newTx);
    return [newTx, await newTx.txPayload, await newTx.txExtra] as const;
  }

  createTxPayload(params: createTxPayloadParams, prepareCreate: true): Promise<TxPayload>;
  createTxPayload(params: createTxPayloadParams): Promise<void>;
  async createTxPayload({ tx, address, epochHeight }: createTxPayloadParams, prepareCreate?: true) {
    const from = tx.from ?? (await address?.getValue());
    const chainId = (await address?.network)?.chainId;
    const txPayload = _createTxPayload(
      {
        type: String(tx.type),
        from,
        to: tx.to,
        gasPrice: String(tx.gasPrice || ''),
        maxFeePerGas: String(tx.maxFeePerGas || ''),
        maxPriorityFeePerGas: String(tx.maxPriorityFeePerGas || ''),
        gasLimit: String(tx.gasLimit ?? (tx as any).gas ?? ''),
        value: String(tx.value),
        nonce: Number(tx.nonce),
        chainId,
        data: tx.data,
        storageLimit: String(tx.storageLimit || ''),
        epochHeight,
      },
      true,
    );
    if (prepareCreate) return txPayload;
    return database.write(async () => {
      await database.batch(txPayload);
    });
  }

  createTxExtra(params: { assetType?: AssetType; action?: SpeedUpAction }, tx: ITxEvm, prepareCreate: true): Promise<TxExtra>;
  createTxExtra(params: { assetType?: AssetType; action?: SpeedUpAction }, tx: ITxEvm): Promise<void>;
  async createTxExtra(params: { assetType?: AssetType; action?: SpeedUpAction }, tx: ITxEvm, prepareCreate?: true) {
    const { to, data } = tx;
    const txExtra = _createTxExtra(
      {
        ok: true,
        simple: params.assetType === AssetType.Native,
        contractInteraction: params.assetType !== AssetType.Native,
        token20: params.assetType === AssetType.ERC20,
        tokenNft: params.assetType === AssetType.ERC721 || params.assetType === AssetType.ERC1155,
        method: params.assetType === AssetType.ERC20 ? 'transfer' : undefined,
        contractCreation: !to && !!data,
        sendAction: params.action,
      },
      true,
    );
    if (prepareCreate) return txExtra;
    return database.write(async () => {
      await database.batch(txExtra);
    });
  }

  async speedUpTx(params: SpeedUpTransactionParams, prepareCreate?: true) {
    try {
      const { originTx, tx: txData, epochHeight, txRaw, txHash, sendAt, signature, speedupAction } = params;
      const [address, app] = await Promise.all([originTx.address, originTx.app]);
      const network = await address.network;
      const asset = speedupAction === SpeedUpAction.Cancel ? (await network.assets).find((i) => i.type === AssetType.Native) : await originTx.asset;
      const [txPayload, txExtra] = await Promise.all([
        this.createTxPayload(
          {
            tx: txData,
            address,
            epochHeight,
          },
          true,
        ),
        this.createTxExtra(
          {
            action: speedupAction,
            assetType: asset?.type,
          },
          txData,
          true,
        ),
      ]);
      const isWaitting = await this.isWaitting(address, txData.nonce);

      const tx = _createTx(
        {
          address,
          raw: txRaw,
          hash: txHash,
          status: isWaitting ? TxStatus.WAITTING : TxStatus.PENDING,
          sendAt,
          txPayload,
          txExtra,
          asset,
          ...(speedupAction === SpeedUpAction.Cancel
            ? { source: TxSource.SELF, method: 'transfer' }
            : { app, source: originTx.source, method: originTx.method }),
        },
        true,
      );
      signature.updateTx(tx);
      if (prepareCreate) return [tx, txPayload, txExtra] as const;
      return database.write(async () => {
        await database.batch(tx, txPayload, txExtra);
      });
    } catch (error) {
      console.error('speedUpTx error: ', error);
    }
  }
}
