/** executed not mean success, remember check executedStatus */
export enum TxStatus {
  REPLACED = 'REPLACED',
  TEMP_REPLACED = 'TEMP_REPLACED',
  FAILED = 'FAILED',
  WAITTING = 'WAITTING',
  DISCARDED = 'DISCARDED',
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CONFIRMED = 'CONFIRMED',
  FINALIZED = 'FINALIZED',
}

export const ALL_TX_STATUSES = Object.values(TxStatus);
export const PENDING_TX_STATUSES = [TxStatus.WAITTING, TxStatus.DISCARDED, TxStatus.PENDING];
export const PENDING_COUNT_STATUSES = [TxStatus.WAITTING, TxStatus.PENDING];
export const FAILED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.TEMP_REPLACED, TxStatus.FAILED];
export const FINALIZED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.FAILED, TxStatus.FINALIZED];
/** executed not mean success, remember check executedStatus */
export const EXECUTED_TX_STATUSES = [TxStatus.EXECUTED, TxStatus.CONFIRMED, TxStatus.FINALIZED];
/** executed not mean success, remember check executedStatus */
export const EXECUTED_NOT_FINALIZED_TX_STATUSES = [TxStatus.EXECUTED, TxStatus.CONFIRMED];
export const FINISHED_IN_ACTIVITY_TX_STATUSES = [TxStatus.REPLACED, TxStatus.TEMP_REPLACED, TxStatus.EXECUTED, TxStatus.CONFIRMED, TxStatus.FINALIZED];
export const NOT_FINALIZED_TX_STATUSES = [
  TxStatus.WAITTING,
  TxStatus.DISCARDED,
  TxStatus.PENDING,
  TxStatus.EXECUTED,
  TxStatus.CONFIRMED,
  TxStatus.TEMP_REPLACED,
];

export enum ExecutedStatus {
  FAILED = '0',
  SUCCEEDED = '1',
}

export interface Receipt {
  blockHash?: string | null;
  gasUsed?: string | null;
  contractCreated?: string | null;
  transactionIndex?: string | null;
  effectiveGasPrice?: string | null;
  type?: string | null;
  /** blockNumber in evm or epochNumber in cfx */
  blockNumber?: string | null;
  /** for espace */
  cumulativeGasUsed?: string | null;
  /** for core space */
  gasFee?: string | null;
  /** for core space */
  storageCollateralized?: string | null;
  /** for core space */
  gasCoveredBySponsor?: boolean | null;
  /** for core space */
  storageCoveredBySponsor?: boolean | null;
  /** for core space */
  storageReleased?: {
    address: string | null;
    collaterals: string | null;
  }[];
}

export enum TxSource {
  SELF = 'self',
  DAPP = 'dapp',
  SCAN = 'scan',
}
