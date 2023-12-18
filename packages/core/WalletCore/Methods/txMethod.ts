import { injectable } from 'inversify';
import { querySelectedNetwork } from '../../database/models/Network/query';
import { querySelectedAddress } from '../../database/models/Address/query';
import { Asset, AssetType } from '../../database/models/Asset';
import { queryAssetByAddress } from '../../database/models/Asset/query';
import { createTx as _createTx } from '../../database/models/Tx/query';
import { createTxPayload as _createTxPayload } from '../../database/models/TxPayload/query';
import { createTxExtra as _createTxExtra } from '../../database/models/TxExtra/query';
import { TransactionSubjectValue } from '../Events/broadcastTransactionSubject';
import database from '../../database';
import { Tx } from '@core/database/models/Tx';
import { Address } from '@core/database/models/Address';
import { TxPayload } from '@core/database/models/TxPayload';
import { TxExtra } from '@core/database/models/TxExtra';
import { TxStatus } from '@core/database/models/Tx/type';
import { getAddress as toChecksumAddress } from 'ethers';

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
      const [txPayload, txExtra] = await Promise.all([
        this.createTxPayload(
          {
            transaction: params.transaction,
            address,
          },
          true
        ),
        this.createTxExtra(params.extraParams, true),
      ]);
      let asset: Asset | undefined;
      if (params.extraParams.assetType === AssetType.Native) {
        const networks = await querySelectedNetwork();
        asset = (await networks[0].assets).find((i) => i.type === AssetType.Native);
      } else if (params.extraParams.contractAddress) {
        const assets = await queryAssetByAddress(toChecksumAddress(params.extraParams.contractAddress));
        asset = assets?.[0];
      }

      const tx = _createTx(
        {
          address,
          raw: params.txRaw,
          hash: params.txHash,
          status: TxStatus.PENDING,
          isLocal: true,
          txPayload,
          txExtra,
          asset,
          blockNumber: params.extraParams.blockNumber,
        },
        true
      );
      if (prepareCreate) return [tx, txPayload, txExtra] as const;
      return database.write(async () => {
        await database.batch(tx, txPayload, txExtra);
      });
    } catch (error) {
      console.error('createTx error: ', error);
    }
  }

  createTxPayload(params: { transaction: TransactionSubjectValue['transaction']; address?: Address }, prepareCreate: true): Promise<TxPayload>;
  createTxPayload(params: { transaction: TransactionSubjectValue['transaction']; address?: Address }): Promise<void>;
  async createTxPayload({ transaction, address }: { transaction: TransactionSubjectValue['transaction']; address?: Address }, prepareCreate?: true) {
    const from = transaction.from ?? (await address?.getValue());
    const txPayload = _createTxPayload(
      {
        type: transaction.type?.toString(),
        from,
        to: transaction.to,
        gasPrice: transaction.gasPrice?.toString(),
        gas: transaction.gasLimit.toString(),
        value: transaction.value.toString(),
        nonce: transaction.nonce.toString(),
        chainId: transaction.chainId.toString(),
        data: transaction.data,
        accessList: transaction.accessList,
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
      },
      true
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
      true
    );
    if (prepareCreate) return txExtra;
    return database.write(async () => {
      await database.batch(txExtra);
    });
  }
}
