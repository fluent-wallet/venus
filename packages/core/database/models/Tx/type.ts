export enum TxStatus {
  REPLACED = '-2',
  FAILED = '-1',
  UNSENT = '0',
  WAITTING = '5',
  PENDING = '1',
  EXECUTED = '2',
  CONFIRMED = '3',
  FINALIZED = '4',
}

export const ALL_TX_STATUSES = Object.values(TxStatus);
export const PENDING_TX_STATUSES = [TxStatus.WAITTING, TxStatus.UNSENT, TxStatus.PENDING];
export const FAILED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.FAILED];
export const FINALIZED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.FAILED, TxStatus.FINALIZED];
export const EXECUTED_NOT_FINALIZED_TX_STATUSES = [TxStatus.EXECUTED, TxStatus.CONFIRMED];
export const FINISHED_IN_ACTIVITY_TX_STATUSES = [TxStatus.REPLACED, TxStatus.EXECUTED, TxStatus.CONFIRMED, TxStatus.FINALIZED];
export const NOT_FINALIZED_TX_STATUSES = [TxStatus.WAITTING, TxStatus.UNSENT, TxStatus.PENDING, TxStatus.EXECUTED, TxStatus.CONFIRMED];

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
