import { injectable } from 'inversify';
import { querySelectedNetwork } from '../../database/models/Network/query';
import { querySelectedAddress } from '../../database/models/Address/query';
import { Asset, AssetType } from '../../database/models/Asset';
import { createTx as _createTx, queryTxsWithAddress } from '../../database/models/Tx/query';
import { createTxPayload as _createTxPayload } from '../../database/models/TxPayload/query';
import { createTxExtra as _createTxExtra } from '../../database/models/TxExtra/query';
import { TransactionSubjectValue } from '../Events/broadcastTransactionSubject';
import database from '../../database';
import { Tx } from '@core/database/models/Tx';
import { Address } from '@core/database/models/Address';
import { TxPayload } from '@core/database/models/TxPayload';
import { TxExtra } from '@core/database/models/TxExtra';
import { TxSource, TxStatus } from '@core/database/models/Tx/type';
import { getAddress as toChecksumAddress } from 'ethers';

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
      const selectedAddressList = await querySelectedAddress();
      const address = selectedAddressList?.[0];
      if (!address) {
        console.error('TX: no address selected!');
      }
      const updated = await this.updateTx(address, params);
      if (updated) return updated;
      const [txPayload, txExtra] = await Promise.all([
        this.createTxPayload(
          {
            tx: params.tx,
            address,
            epochHeight: params.extraParams.epochHeight,
          },
          true,
        ),
        this.createTxExtra(params.extraParams, true),
      ]);
      let asset: Asset | undefined;
      const networks = await querySelectedNetwork();
      const network = networks[0];
      if (params.extraParams.assetType === AssetType.Native) {
        asset = (await network.assets).find((i) => i.type === AssetType.Native);
      } else if (params.extraParams.contractAddress) {
        asset = await network.queryAssetByAddress(params.extraParams.contractAddress);
      }

      const tx = _createTx(
        {
          address,
          raw: params.txRaw,
          hash: params.txHash,
          status: params.extraParams.err ? TxStatus.FAILED : TxStatus.PENDING,
          sendAt: params.extraParams.sendAt,
          txPayload,
          txExtra,
          asset,
          err: params.extraParams.err,
          errorType: params.extraParams.errorType,
          // TODO: set by params
          source: TxSource.SELF,
          // TODO: set by params
          method: 'Send',
        },
        true,
      );
      if (prepareCreate) return [tx, txPayload, txExtra] as const;
      return database.write(async () => {
        await database.batch(tx, txPayload, txExtra);
      });
    } catch (error) {
      console.error('createTx error: ', error);
    }
  }

  async updateTx(selectAddress: Address, params: TransactionSubjectValue) {
    const sameTx = await queryTxsWithAddress(selectAddress.id, {
      raw: params.txRaw,
    });
    console.log('sameTx', sameTx.length);
    if (!sameTx || sameTx.length === 0) {
      // no same tx in db
      return false;
    }
    // hasSuccessTx: already success, skip create/update
    const hasSuccessTx = sameTx.some((tx) => tx.status !== TxStatus.FAILED);
    console.log('hasSuccessTx', hasSuccessTx);
    const tx = sameTx[0];
    let newTx = tx;
    if (!hasSuccessTx) {
      newTx = await tx.updateSelf((_tx) => {
        _tx.hash = params.txHash;
        _tx.status = params.extraParams.err ? TxStatus.FAILED : TxStatus.PENDING;
        _tx.sendAt = params.extraParams.sendAt;
        _tx.err = params.extraParams.err;
        _tx.errorType = params.extraParams.errorType;
        // TODO: set by params
        _tx.source = TxSource.SELF;
        // TODO: set by params
        _tx.method = 'Send';
      });
    }
    return [newTx, await newTx.txPayload, await newTx.txExtra] as const;
  }

  createTxPayload(params: createTxPayloadParams, prepareCreate: true): Promise<TxPayload>;
  createTxPayload(params: createTxPayloadParams): Promise<void>;
  async createTxPayload({ tx, address, epochHeight }: createTxPayloadParams, prepareCreate?: true) {
    const from = tx.from ?? (await address?.getValue());
    const chainId = (await address?.network)?.chainId;
    const txPayload = _createTxPayload(
      {
        type: tx.type?.toString(),
        from,
        to: tx.to,
        gasPrice: tx.gasPrice?.toString(),
        gas: String(tx.gasLimit),
        value: String(tx.value),
        nonce: Number(tx.nonce),
        chainId,
        data: tx.data,
        storageLimit: tx.storageLimit,
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
