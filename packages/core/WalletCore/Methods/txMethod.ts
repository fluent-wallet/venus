import type { Address } from '@core/database/models/Address';
import type { Tx } from '@core/database/models/Tx';
import { TxSource, TxStatus } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import { injectable } from 'inversify';
import database from '../../database';
import { type Asset, AssetType } from '../../database/models/Asset';
import { createTx as _createTx, queryTxsWithAddress } from '../../database/models/Tx/query';
import { createTxExtra as _createTxExtra } from '../../database/models/TxExtra/query';
import { createTxPayload as _createTxPayload } from '../../database/models/TxPayload/query';
import type { TransactionSubjectValue } from '../Events/broadcastTransactionSubject';

interface createTxPayloadParams {
  tx: TransactionSubjectValue['tx'];
  address?: Address;
  epochHeight?: string | null;
}

@injectable()
export class TxMethod {
  createTx(params: TransactionSubjectValue, prepareCreate: true): Promise<readonly [Tx, TxPayload, TxExtra]>;
  createTx(params: TransactionSubjectValue): Promise<void>;
  async createTx(params: TransactionSubjectValue, prepareCreate?: true) {
    try {
      const { address, tx: _tx, extraParams, txRaw, txHash, signature, app } = params;
      const updated = await this.updateTx(params);
      if (updated) return updated;
      const [txPayload, txExtra] = await Promise.all([
        this.createTxPayload(
          {
            tx: _tx,
            address,
            epochHeight: extraParams.epochHeight,
          },
          true,
        ),
        this.createTxExtra(extraParams, true),
      ]);
      let asset: Asset | undefined;
      const network = await address.network;
      if (params.extraParams.assetType === AssetType.Native) {
        asset = (await network.assets).find((i) => i.type === AssetType.Native);
      } else if (params.extraParams.contractAddress) {
        asset = await network.queryAssetByAddress(params.extraParams.contractAddress);
      }

      const tx = _createTx(
        {
          address,
          app,
          raw: txRaw,
          hash: txHash,
          status: extraParams.err ? TxStatus.FAILED : TxStatus.PENDING,
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

  async updateTx(params: TransactionSubjectValue) {
    const { address, extraParams, txRaw, txHash, signature, app } = params;
    const sameTx = await queryTxsWithAddress(address.id, {
      raw: txRaw,
    });
    if (!sameTx || sameTx.length === 0) {
      // no same tx in db
      return false;
    }
    // hasSuccessTx: already success, skip create/update
    const hasSuccessTx = sameTx.some((tx) => tx.status !== TxStatus.FAILED);
    const tx = sameTx[0];
    let newTx = tx;
    if (!hasSuccessTx) {
      newTx = await tx.updateSelf((_tx) => {
        _tx.app.id = app?.id;
        _tx.hash = txHash;
        _tx.status = extraParams.err ? TxStatus.FAILED : TxStatus.PENDING;
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
        gas: String(tx.gasLimit),
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

  createTxExtra(tx: TransactionSubjectValue['extraParams'], prepareCreate: true): Promise<TxExtra>;
  createTxExtra(tx: TransactionSubjectValue['extraParams']): Promise<void>;
  async createTxExtra(tx: TransactionSubjectValue['extraParams'], prepareCreate?: true) {
    const txExtra = _createTxExtra(
      {
        ok: true,
        simple: tx.assetType === AssetType.Native,
        contractInteraction: tx.assetType !== AssetType.Native,
        token20: tx.assetType === AssetType.ERC20,
        tokenNft: tx.assetType === AssetType.ERC721 || tx.assetType === AssetType.ERC1155,
        address: tx.assetType === AssetType.ERC20 ? tx.to : undefined,
        method: tx.assetType === AssetType.ERC20 ? 'transfer' : undefined,
      },
      true,
    );
    if (prepareCreate) return txExtra;
    return database.write(async () => {
      await database.batch(txExtra);
    });
  }
}
