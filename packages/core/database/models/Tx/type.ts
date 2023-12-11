export enum TxStatus {
  SKIPPED = '-2',
  FAILED = '-1',
  UNSENT = '0',
  SENDING = '1',
  PENDING = '2',
  PACKAGED = '3',
  EXECUTED = '4',
  CONFIRMED = '5',
}

export interface Receipt {
  blockHash?: string | null;
  gasUsed?: string | null;
  contractCreated?: string | null;
  // ↓↓↓↓↓↓↓↓↓↓↓ for espace ↓↓↓↓↓↓↓↓↓↓↓
  cumulativeGasUsed?: string | null;
  effectiveGasPrice?: string | null;
  type?: string | null;
  blockNumber?: string | null;
  transactionIndex?: string | null;
  // ↓↓↓↓↓↓↓↓↓↓↓ for core space ↓↓↓↓↓↓↓↓↓↓↓
  index?: string | null;
  epochNumber?: string | null;
  gasFee?: string | null;
  storageCollateralized?: string | null;
  gasCoveredBySponsor?: boolean | null;
  storageCoveredBySponsor?: boolean | null;
  storageReleased?: {
    address: string | null;
    collaterals: string | null;
  }[];
}
