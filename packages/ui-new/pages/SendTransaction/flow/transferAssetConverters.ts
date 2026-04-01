import { ASSET_TYPE } from '@core/types';
import type { IAsset, INftCollection, INftItem } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import { toBaseUnitsFromDecimalBalance } from '@utils/toBaseUnits';
import type { TransferAsset, TransferFungibleAsset, TransferNftAsset } from './types';

function isFungibleAssetType(type: string): type is TransferFungibleAsset['type'] {
  return type === ASSET_TYPE.Native || type === ASSET_TYPE.ERC20;
}

// Bridge the flow-local TransferAsset shape with the existing asset types used by current screens and services.
export function toTransferAssetFromSelection(params: { asset: AssetInfo; nftItemDetail?: INftItem }): TransferAsset {
  const { asset, nftItemDetail } = params;

  if (asset.type === ASSET_TYPE.ERC721 || asset.type === ASSET_TYPE.ERC1155) {
    if (!nftItemDetail) {
      throw new Error(`NFT selection requires nftItemDetail for ${asset.type}.`);
    }

    return {
      type: asset.type,
      contractAddress: asset.contractAddress ?? '',
      name: asset.name ?? '',
      symbol: asset.symbol ?? '',
      decimals: 0,
      balanceBaseUnits: nftItemDetail.amount,
      icon: asset.icon,
      priceInUSDT: asset.priceInUSDT,
      nft: {
        nftTokenId: nftItemDetail.tokenId,
        amount: nftItemDetail.amount,
        name: nftItemDetail.name,
        icon: nftItemDetail.icon ?? undefined,
      },
    };
  }

  return {
    ...toTransferAssetFromAssetInfo(asset),
  };
}

export function toTransferAssetFromAssetInfo(asset: AssetInfo): TransferFungibleAsset {
  if (!isFungibleAssetType(asset.type)) {
    throw new Error(`TransferAsset from AssetInfo only supports fungible assets. Received ${String(asset.type)}.`);
  }

  return {
    type: asset.type,
    contractAddress: asset.contractAddress ?? '',
    name: asset.name ?? '',
    symbol: asset.symbol ?? '',
    decimals: asset.decimals,
    balanceBaseUnits: asset.balance ?? '0',
    icon: asset.icon,
    priceInUSDT: asset.priceInUSDT,
    nft: null,
  };
}

export function toTransferAssetFromIAsset(asset: IAsset): TransferFungibleAsset | null {
  if (!isFungibleAssetType(asset.type) || asset.decimals === null) {
    return null;
  }

  return {
    type: asset.type,
    contractAddress: asset.contractAddress ?? '',
    name: asset.name ?? '',
    symbol: asset.symbol ?? '',
    decimals: asset.decimals,
    balanceBaseUnits: toBaseUnitsFromDecimalBalance(asset.balance, asset.decimals),
    icon: asset.icon ?? undefined,
    priceInUSDT: asset.priceInUSDT ?? undefined,
    nft: null,
  };
}

export function toTransferAssetFromNft(params: {
  collection: Pick<INftCollection, 'contractAddress' | 'type' | 'name' | 'symbol' | 'icon'>;
  item: INftItem;
}): TransferNftAsset {
  if (params.collection.type !== ASSET_TYPE.ERC721 && params.collection.type !== ASSET_TYPE.ERC1155) {
    throw new Error(`TransferAsset from NFT collection requires ERC721 or ERC1155. Received ${String(params.collection.type)}.`);
  }

  return {
    type: params.collection.type,
    contractAddress: params.collection.contractAddress,
    name: params.collection.name ?? '',
    symbol: params.collection.symbol ?? '',
    decimals: 0,
    balanceBaseUnits: params.item.amount,
    icon: params.collection.icon ?? undefined,
    nft: {
      nftTokenId: params.item.tokenId,
      amount: params.item.amount,
      name: params.item.name,
      icon: params.item.icon ?? undefined,
    },
  };
}

export function toLegacyAssetInfo(asset: TransferAsset): AssetInfo {
  return {
    type: asset.type,
    contractAddress: asset.contractAddress ?? '',
    name: asset.name ?? '',
    symbol: asset.symbol,
    decimals: asset.decimals,
    balance: asset.balanceBaseUnits,
    icon: asset.icon,
    priceInUSDT: asset.priceInUSDT,
  };
}

export function toLegacyNftItem(asset: TransferAsset): INftItem | undefined {
  if (asset.type !== ASSET_TYPE.ERC721 && asset.type !== ASSET_TYPE.ERC1155) {
    return undefined;
  }

  return {
    tokenId: asset.nft.nftTokenId,
    name: asset.nft.name ?? '',
    icon: asset.nft.icon,
    amount: asset.nft.amount,
  };
}
