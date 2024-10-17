/** executed not mean success, remember check executedStatus */
export enum TxStatus {
  /** tx is finalized replaced */
  REPLACED = 'REPLACED',
  /** tx is temp replaced, maybe changed to REPLACED or EXECUTED */
  TEMP_REPLACED = 'TEMP_REPLACED',
  /** initial send failed, hidden in Activity */
  SEND_FAILED = 'SEND_FAILED',
  /** tx send success but nonce is in future */
  WAITTING = 'WAITTING',
  /** tx is discarded by tx pool, changed to PENDING until tx is found in poll */
  DISCARDED = 'DISCARDED',
  /** after send or tx is in tx pool but not executed yet */
  PENDING = 'PENDING',
  /** tx is executed but not confirmed */
  EXECUTED = 'EXECUTED',
  /** tx is executed and confirmed, waitting finalized confirmed */
  CONFIRMED = 'CONFIRMED',
  /** tx is finalized confirmed */
  FINALIZED = 'FINALIZED',
}

export const ALL_TX_STATUSES = Object.values(TxStatus);
export const PENDING_TX_STATUSES = [TxStatus.WAITTING, TxStatus.DISCARDED, TxStatus.PENDING];
export const PENDING_COUNT_STATUSES = [TxStatus.WAITTING, TxStatus.PENDING];
export const FAILED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.TEMP_REPLACED, TxStatus.SEND_FAILED];
export const FINALIZED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.SEND_FAILED, TxStatus.FINALIZED];
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
