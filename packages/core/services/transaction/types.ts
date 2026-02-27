import type { Address, AssetType, Hex, SpeedUpAction, TxStatus } from '@core/types';
import type { NetworkType } from '@core/utils/consts';
import type { EvmRpcTransactionRequest } from './dappTypes';

export interface TransactionFilter {
  addressId: string;
  status?: 'pending' | 'finished' | 'all';
  limit?: number;
}

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

  status: TxStatus;
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
  status: TxStatus;
  timestamp: number;
  networkId: string;
}
