export enum TxStatus {
  REPLACED = '-2',
  FAILED = '-1',
  UNSENT = '0',
  PENDING = '1',
  EXECUTED = '2',
  CONFIRMED = '3',
  FINALIZED = '4',
}

export const ALL_TX_STATUSES = Object.values(TxStatus);
export const PENDING_TX_STATUSES = [TxStatus.UNSENT, TxStatus.PENDING];
export const FAILED_TX_STATUSES = [TxStatus.REPLACED, TxStatus.FAILED];
export const EXECUTED_NOT_FINALIZED_TX_STATUSES = [TxStatus.EXECUTED, TxStatus.CONFIRMED];
export const NOT_FINALIZED_TX_STATUSES = [TxStatus.UNSENT, TxStatus.PENDING, TxStatus.EXECUTED, TxStatus.CONFIRMED];

export enum ExecutedStatus {
  FAILED = '0',
  SUCCEEDED = '1',
}

export interface Receipt {
  blockHash?: string | null;
  gasUsed?: string | null;
  contractCreated?: string | null;
  transactionIndex?: string | null;
  blockNumber?: string | null;
  // ↓↓↓↓↓↓↓↓↓↓↓ for espace ↓↓↓↓↓↓↓↓↓↓↓
  cumulativeGasUsed?: string | null;
  effectiveGasPrice?: string | null;
  type?: string | null;
  // ↓↓↓↓↓↓↓↓↓↓↓ for core space ↓↓↓↓↓↓↓↓↓↓↓
  gasFee?: string | null;
  storageCollateralized?: string | null;
  gasCoveredBySponsor?: boolean | null;
  storageCoveredBySponsor?: boolean | null;
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
