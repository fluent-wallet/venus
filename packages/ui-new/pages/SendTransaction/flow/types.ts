import type { TransferAmountIntent } from '@core/services/transaction';
import type { ASSET_TYPE } from '@core/types';

type TransferAssetBase = {
  contractAddress?: string;
  name?: string;
  symbol: string;
  decimals: number;
  balanceBaseUnits: string;
  icon?: string;
  priceInUSDT?: string;
};

export type TransferNftSnapshot = {
  nftTokenId: string;
  amount: string;
  name?: string;
  icon?: string;
};

export type TransferFungibleAsset = TransferAssetBase & {
  type: typeof ASSET_TYPE.Native | typeof ASSET_TYPE.ERC20;
  nft: null;
};

export type TransferErc721Asset = TransferAssetBase & {
  type: typeof ASSET_TYPE.ERC721;
  decimals: 0;
  nft: TransferNftSnapshot;
};

export type TransferErc1155Asset = TransferAssetBase & {
  type: typeof ASSET_TYPE.ERC1155;
  decimals: 0;
  nft: TransferNftSnapshot;
};

export type TransferNftAsset = TransferErc721Asset | TransferErc1155Asset;
export type TransferAsset = TransferFungibleAsset | TransferNftAsset;

export type SendEntry =
  | { kind: 'empty' }
  | {
      kind: 'recipient';
      recipient: string;
      assetSearchText?: string;
    }
  | {
      kind: 'asset';
      recipient: string;
      asset: TransferAsset;
    }
  | {
      kind: 'review';
      recipient: string;
      asset: TransferFungibleAsset;
      amountIntent: TransferAmountIntent;
    }
  | {
      kind: 'review';
      recipient: string;
      asset: TransferErc1155Asset;
      amountIntent: { kind: 'exact'; amount: string };
    };

export type TransferDraft = {
  recipient: string;
  asset: TransferAsset | null;
  amountIntent: TransferAmountIntent;
};

export type SendFlowStep = 'recipient' | 'asset' | 'amount' | 'review';

export type InitialSendFlowState = {
  draft: TransferDraft;
  initialStep: SendFlowStep;
  assetSearchText?: string;
};

export const EMPTY_TRANSFER_DRAFT: TransferDraft = {
  recipient: '',
  asset: null,
  amountIntent: {
    kind: 'exact',
    amount: '',
  },
};
