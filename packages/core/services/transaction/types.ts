import type { Address, AssetType, AssetTypeValue, Hex, SpeedUpAction, TxStatusValue } from '@core/types';
import type { NetworkType } from '@core/utils/consts';
import type { EvmRpcTransactionRequest } from './dappTypes';

export interface TransactionFilter {
  addressId: string;
  status?: 'pending' | 'finished' | 'all';
  limit?: number;
}

/**
 * Transaction origin.
 * Kept as a small string union so UI does not depend on WatermelonDB enums.
 */
export type TransactionSource = 'self' | 'dapp' | 'scan' | 'unknown';

export type GasEstimateLevel = 'low' | 'medium' | 'high';

export type LegacyLikeGasEstimate = {
  gasLimit: Hex;
  gasPrice: Hex;
  storageLimit?: Hex;
  estimate?: Record<GasEstimateLevel, { suggestedGasPrice: Hex; gasCost: Hex }>;
  estimateOf1559?: Record<GasEstimateLevel, { suggestedMaxFeePerGas: Hex; suggestedMaxPriorityFeePerGas: Hex; gasCost: Hex }>;
  nonce: number;
};

export type GasPricingEstimate = {
  gasLimit: Hex;
  storageLimit?: Hex;
  gasPrice: Hex;
  constraints: {
    minGasPriceWei: Hex;
  };
  pricing:
    | { kind: 'legacy'; levels: Record<GasEstimateLevel, { gasPrice: Hex; gasCost: Hex }> }
    | { kind: 'eip1559'; levels: Record<GasEstimateLevel, { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex; gasCost: Hex }> };
  nonce: number;
};

export interface RecentlyAddress {
  addressValue: Address;
  direction: 'inbound' | 'outbound';
  isLocalAccount: boolean;
  lastUsedAt: number;
}

export type TransactionReceiptKind = 'evm' | 'cfx' | 'unknown';

/**
 * Receipt snapshot exposed to UI.
 * Values follow the database receipt storage format (hex quantity strings or null).
 */
export type TransactionReceiptSnapshot = {
  kind: TransactionReceiptKind;
  blockHash?: string | null;
  gasUsed?: string | null;
  contractCreated?: string | null;
  transactionIndex?: string | null;
  effectiveGasPrice?: string | null;
  type?: string | null;
  /** blockNumber in evm or epochNumber in cfx */
  blockNumber?: string | null;
  /** for EVM */
  cumulativeGasUsed?: string | null;
  /** for Conflux Core Space */
  gasFee?: string | null;
  /** for Conflux Core Space */
  storageCollateralized?: string | null;
  /** for Conflux Core Space */
  gasCoveredBySponsor?: boolean | null;
  /** for Conflux Core Space */
  storageCoveredBySponsor?: boolean | null;
  /** for Conflux Core Space */
  storageReleased?: {
    address: string | null;
    collaterals: string | null;
  }[];
};

export type TransactionAssetSnapshot = {
  type: AssetTypeValue;
  contractAddress: Address | null;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  icon: string | null;
};

export type TransactionNetworkSnapshot = {
  id: string;
  name: string;
  chainId: string;
  networkType: NetworkType;
  scanUrl: string | null;
};

export type TransactionPayloadSnapshot = {
  from: Address | null;
  to: Address | null;
  value: string | null;
  data: Hex | null;
  nonce: number | null;
  chainId: string | null;
  gasLimit?: string | null;
  gasPrice?: string | null;
  maxFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  storageLimit?: string | null;
  epochHeight?: string | null;
  type?: string | null;
};

export type TransactionExtraSnapshot = {
  sendAction: SpeedUpAction | null;
};

export type TransactionDisplaySnapshot = {
  from: Address | null;
  to: Address | null;
  value: string | null;
  tokenId: string;
  isTransfer: boolean;
};

/**
 * Activity list row snapshot for UI.
 */
export interface IActivityTransaction {
  id: string;
  hash: string;
  status: TxStatusValue;
  source: TransactionSource;
  method: string;

  createdAtMs: number;
  executedAtMs: number | null;
  sendAtMs: number;
  timestampMs: number;

  networkId: string;
  sendAction: SpeedUpAction | null;

  payload: TransactionPayloadSnapshot;
  asset: TransactionAssetSnapshot | null;
  display: TransactionDisplaySnapshot;
}

/**
 * Transaction detail snapshot for UI.
 */
export interface ITransactionDetail {
  id: string;
  hash: string;
  status: TxStatusValue;
  source: TransactionSource;
  method: string;

  createdAtMs: number;
  executedAtMs: number | null;
  sendAtMs: number;

  network: TransactionNetworkSnapshot;
  asset: TransactionAssetSnapshot | null;
  nativeAsset: TransactionAssetSnapshot | null;

  payload: TransactionPayloadSnapshot;
  extra: TransactionExtraSnapshot;
  receipt: TransactionReceiptSnapshot | null;

  err: string | null;
  errorType: string | null;

  display: TransactionDisplaySnapshot;
}

export interface SendTransactionInput {
  addressId: string;
  to: Address;
  amount: string;
  assetType: AssetType;
  assetDecimals: number;
  contractAddress?: Address;
  nftTokenId?: string;
  data?: Hex;
  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  storageLimit?: string;

  signal?: AbortSignal;
}

export interface SendERC20Input {
  addressId: string;
  contractAddress: Address;
  to: Address;
  amount: string;
  assetDecimals: number;

  gasLimit?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
  storageLimit?: string;

  signal?: AbortSignal;
}

export interface EstimateDappTransactionInput {
  addressId: string;
  request: EvmRpcTransactionRequest;
  signal?: AbortSignal;
}

export interface SendDappTransactionInput {
  addressId: string;
  request: EvmRpcTransactionRequest;
  signal?: AbortSignal;
}

export type SpeedUpTxContext = {
  txId: string;
  addressId: string;
  accountId: string;
  networkId: string;
  networkType: NetworkType;
  isHardwareWallet: boolean;

  status: TxStatusValue;
  /**
   * Existing send action of the origin tx (if it is itself a SpeedUp/Cancel replacement).
   */
  sendAction: SpeedUpAction | null;

  assetType: AssetType | null;

  payload: {
    from: Address;
    to: Address | '';
    value: string;
    data: Hex;
    chainId: string;
    nonce: number;
    type?: string | null;
    gasPrice?: string | null;
    maxFeePerGas?: string | null;
    maxPriorityFeePerGas?: string | null;
    gasLimit?: string | null;
    storageLimit?: string | null;
    epochHeight?: string | null;
  };
};

export type SpeedUpTxInput = {
  txId: string;
  action: SpeedUpAction;
  feeOverrides:
    | { gasPrice: string; maxFeePerGas?: never; maxPriorityFeePerGas?: never }
    | { maxFeePerGas: string; maxPriorityFeePerGas: string; gasPrice?: never };
  advanceOverrides?: {
    gasLimit?: string;
    storageLimit?: string;
  };
  /**
   * Replacement tx must use the origin nonce, but allow passing it explicitly to avoid accidental drift.
   */
  nonce: number;
  signal?: AbortSignal;
};

/**
 * Plain transaction snapshot for UI
 */
export interface ITransaction {
  id: string;
  hash: string;
  from: Address;
  to: Address;
  value: string;
  status: TxStatusValue;
  timestamp: number;
  networkId: string;
}
