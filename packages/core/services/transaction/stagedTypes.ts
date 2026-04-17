import type { Address, Hex, SpeedUpAction } from '@core/types';
import type { NetworkType } from '@core/utils/consts';
import type { DappTransactionRequest, EvmRpcTransactionRequest } from './dappTypes';

export type FeePresetId = 'low' | 'medium' | 'high';

export type TransferAmountIntent = { kind: 'exact'; amount: string } | { kind: 'max' };

export type TransferAssetKind = 'native' | 'fungible' | 'nft721' | 'nft1155';

export type TransferAssetStandard = 'native' | 'erc20' | 'crc20' | 'erc721' | 'crc721' | 'erc1155' | 'crc1155';

export type ExecutionTarget = { kind: 'user'; address: string } | { kind: 'contract'; address: string } | { kind: 'builtin'; address: string };

export type FeeFields =
  | {
      gasPrice: string;
      maxFeePerGas?: never;
      maxPriorityFeePerGas?: never;
    }
  | {
      maxFeePerGas: string;
      maxPriorityFeePerGas: string;
      gasPrice?: never;
    };

export type FeeSelection =
  | {
      kind: 'preset';
      presetId: FeePresetId;
    }
  | {
      kind: 'custom';
      fee: FeeFields;
    };

export type ReviewError =
  | { code: 'invalid_recipient'; message: string }
  | { code: 'invalid_amount'; message: string }
  | { code: 'insufficient_asset_balance'; message: string }
  | { code: 'insufficient_native_for_fee'; message: string }
  | { code: 'sponsor_check_failed'; message: string }
  | { code: 'unsupported'; message: string };

export type TransactionQuoteInput = {
  from: Address;
  to?: Address;
  value?: Hex;
  data?: Hex;
  withNonce?: boolean;
};

export type QuoteTransactionRequest = {
  addressId: string;
  to?: Address;
  value?: Hex;
  data?: Hex;
  withNonce?: boolean;
};

export type TransactionQuotePresetOption = {
  presetId: FeePresetId;
  fee: FeeFields;
  gasCost: Hex;
};

export type TransactionQuote = {
  gasLimit: Hex;
  storageLimit?: Hex;
  nonce: number | null;
  constraints: {
    minGasPriceWei: Hex;
  };
  presetOptions: readonly TransactionQuotePresetOption[];
};

export type TransactionReviewOverride = {
  feeSelection?: FeeSelection;
  gasLimit?: string;
  storageLimit?: string;
  nonce?: number;
};
export type PreparedFee = {
  fields: FeeFields;
  gasLimit: string;
  storageLimit?: string;
  nonce: number;
  type?: number;
  epochHeight?: number;
};

export type PreparedRuntimeHints = {
  refreshEpochHeightOnExecute?: boolean;
};

export type PreparedExecutionRequest = {
  from: Address;
  to?: Address;
  value: Hex;
  data: Hex;
  chainId: string;
};

export type PreparedTransferAsset = {
  kind: TransferAssetKind;
  standard: TransferAssetStandard;
  contractAddress?: Address;
  amount?: string;
  tokenId?: string;
  quantity?: string;
  symbol?: string;
  decimals?: number;
};

export type TransferIntent = {
  recipient: Address;
  asset: PreparedTransferAsset;
  amount: TransferAmountIntent;
  data?: Hex;
};

export type PrecheckTransferInput = {
  addressId: string;
  intent: TransferIntent;
};

export type PrecheckTransferResult = {
  maxAmount: string | null;
  error: ReviewError | null;
  canContinue: boolean;
};

export type ReviewFee = {
  selection: FeeSelection;
  fields: FeeFields;
  gasLimit: string;
  storageLimit?: string;
  nonce: number;
};

export type SponsorSnapshot = {
  gasSponsored: boolean;
  storageSponsored: boolean;
  message?: string;
} | null;

export type TransferReviewSummary = {
  transfer: {
    recipient: Address;
    amount: string;
  };
  asset: {
    kind: TransferAssetKind;
    standard: TransferAssetStandard;
    symbol?: string | null;
  };
  fee: {
    payableGasFee: string;
    payableStorageCollateral?: string;
  };
};

export type ReviewTransferInput = {
  addressId: string;
  intent: TransferIntent;
  override?: TransactionReviewOverride;
};

export type ReviewTransferResult = {
  summary: TransferReviewSummary | null;
  executionTarget: ExecutionTarget | null;
  fee: ReviewFee | null;
  sponsor: SponsorSnapshot;
  presetOptions: readonly TransactionQuotePresetOption[];
  error: ReviewError | null;
  canSubmit: boolean;
  prepared: PreparedTransfer | null;
};

export type ReplacementReviewSummary = {
  action: SpeedUpAction;
  fee: {
    payableGasFee: string;
    payableStorageCollateral?: string;
  };
};

export type ReviewReplacementInput = {
  txId: string;
  action: SpeedUpAction;
  override?: TransactionReviewOverride;
};

export type ReviewReplacementResult = {
  summary: ReplacementReviewSummary | null;
  fee: ReviewFee | null;
  presetOptions: readonly TransactionQuotePresetOption[];
  error: ReviewError | null;
  canSubmit: boolean;
  prepared: PreparedReplacement | null;
};

export type DappReviewSummary = {
  request: DappTransactionRequest;
  fee: {
    payableGasFee: string;
    payableStorageCollateral?: string;
  };
};
export type ReviewDappTransactionInput = {
  addressId: string;
  request: DappTransactionRequest;
  override?: TransactionReviewOverride;
  app?: {
    identity: string;
    origin?: string;
    name?: string;
    icon?: string;
  } | null;
};

export type ReviewDappTransactionResult = {
  summary: DappReviewSummary | null;
  fee: ReviewFee | null;
  presetOptions: readonly TransactionQuotePresetOption[];
  error: ReviewError | null;
  canSubmit: boolean;
  prepared: PreparedDappTransaction | null;
};

export type PreparedTransfer = {
  preparedKind: 'transfer';
  addressId: string;
  networkType: NetworkType;
  executionTarget: ExecutionTarget;
  asset: PreparedTransferAsset;
  fee: PreparedFee;
  executionRequest: PreparedExecutionRequest;
  runtimeHints?: PreparedRuntimeHints;
};

export type PreparedReplacement = {
  preparedKind: 'replacement';
  addressId: string;
  networkType: NetworkType;
  originTxId: string;
  action: SpeedUpAction;
  fee: PreparedFee;
  executionRequest: PreparedExecutionRequest;
  runtimeHints?: PreparedRuntimeHints;
};

export type PreparedDappTransaction = {
  preparedKind: 'dapp';
  addressId: string;
  networkType: NetworkType;
  request: DappTransactionRequest;
  app?: {
    identity: string;
    origin?: string;
    name?: string;
    icon?: string;
  } | null;
  fee: PreparedFee;
  executionRequest: PreparedExecutionRequest;
  runtimeHints?: PreparedRuntimeHints;
};

export type PreparedTransaction = PreparedTransfer | PreparedReplacement | PreparedDappTransaction;
