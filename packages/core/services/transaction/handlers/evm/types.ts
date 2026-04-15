import type { buildTransactionPayload } from '@core/chains/utils/transactionBuilder';
import type { AssetType, EvmChainProviderLike } from '@core/types';
import type { ReviewError, ReviewFee, TransactionQuotePresetOption } from '../../stagedTypes';
import type { TransactionHandlerContext } from '../types';

export type EvmHandlerDeps = {
  ctx: TransactionHandlerContext;
  chainProvider: EvmChainProviderLike;
};

export type EvmTransferAssetType = AssetType.Native | AssetType.ERC20 | AssetType.ERC721 | AssetType.ERC1155;

export type ComputedTransferPlan = {
  assetType: EvmTransferAssetType;
  decimals: number;
  amount: string;
  amountBaseUnits: bigint;
  nonce: number;
  executionRequest: ReturnType<typeof buildTransactionPayload>;
  gasLimit: string;
  presetOptions: readonly TransactionQuotePresetOption[];
  selection: ReviewFee['selection'];
  feeFields: ReviewFee['fields'];
  gasCost: bigint;
  maxAmount: string;
  error: ReviewError | null;
};

export type TransferPlanResult = { ok: true; value: ComputedTransferPlan } | { ok: false; error: ReviewError; maxAmount: string | null };
