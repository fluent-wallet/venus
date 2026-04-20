import type { TransferAmountIntent, TransferIntent } from '@core/services/transaction';
import { ASSET_TYPE } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import type { TransferAsset } from './types';

export function canUseMaxAmount(asset: TransferAsset): boolean {
  return asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20;
}

export function getTransferAmountInputValue(params: { amountIntent: TransferAmountIntent; resolvedMaxAmount?: string | null }): string {
  if (params.amountIntent.kind === 'exact') {
    return params.amountIntent.amount;
  }

  return params.resolvedMaxAmount ?? '';
}

export function buildTransferIntent(params: {
  recipient: string;
  asset: TransferAsset;
  amountIntent: TransferAmountIntent;
  networkType: NetworkType;
}): TransferIntent | null {
  const { recipient, asset, amountIntent, networkType } = params;

  switch (asset.type) {
    case ASSET_TYPE.Native:
      return {
        recipient,
        asset: {
          kind: 'native',
          standard: 'native',
          symbol: asset.symbol,
          decimals: asset.decimals,
        },
        amount: amountIntent,
      };
    case ASSET_TYPE.ERC20:
      return {
        recipient,
        asset: {
          kind: 'fungible',
          standard: networkType === NetworkType.Conflux ? 'crc20' : 'erc20',
          contractAddress: asset.contractAddress,
          symbol: asset.symbol,
          decimals: asset.decimals,
        },
        amount: amountIntent,
      };
    case ASSET_TYPE.ERC721:
      if (networkType === NetworkType.Conflux) {
        return null;
      }

      return {
        recipient,
        asset: {
          kind: 'nft721',
          standard: 'erc721',
          contractAddress: asset.contractAddress,
          tokenId: asset.nft.nftTokenId,
          symbol: asset.symbol,
          decimals: 0,
        },
        amount: {
          kind: 'exact',
          amount: '1',
        },
      };
    case ASSET_TYPE.ERC1155:
      if (networkType === NetworkType.Conflux) {
        return null;
      }

      return {
        recipient,
        asset: {
          kind: 'nft1155',
          standard: 'erc1155',
          contractAddress: asset.contractAddress,
          tokenId: asset.nft.nftTokenId,
          symbol: asset.symbol,
          decimals: 0,
        },
        amount: amountIntent.kind === 'max' ? { kind: 'exact', amount: asset.nft.amount } : amountIntent,
      };
    default:
      return null;
  }
}
