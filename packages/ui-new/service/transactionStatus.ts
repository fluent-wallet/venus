import {
  TX_EXECUTION_STATUS,
  TX_LIFECYCLE_STATUS,
  type TransactionStateSnapshot,
} from '@core/types';

export const TX_STATUS = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Failed: 'failed',
} as const;

export type TxStatusValue = (typeof TX_STATUS)[keyof typeof TX_STATUS];

const PENDING_LIFECYCLE_STATUSES = new Set<TransactionStateSnapshot['lifecycle']>([
  TX_LIFECYCLE_STATUS.Waiting,
  TX_LIFECYCLE_STATUS.Discarded,
  TX_LIFECYCLE_STATUS.Pending,
  TX_LIFECYCLE_STATUS.TempReplaced,
]);

const FAILED_LIFECYCLE_STATUSES = new Set<TransactionStateSnapshot['lifecycle']>([
  TX_LIFECYCLE_STATUS.Replaced,
  TX_LIFECYCLE_STATUS.SendFailed,
]);

const SUCCESSFUL_LIFECYCLE_STATUSES = new Set<TransactionStateSnapshot['lifecycle']>([
  TX_LIFECYCLE_STATUS.Executed,
  TX_LIFECYCLE_STATUS.Confirmed,
  TX_LIFECYCLE_STATUS.Finalized,
]);

export type TransactionDetailBadgeStatus = 'pending' | 'confirmed' | 'finalized' | 'failed';
export type TransactionDetailLabelStatus = 'pending' | 'confirmed' | 'failed';

export function isTransactionPendingState(state: TransactionStateSnapshot | null | undefined): boolean {
  if (!state) return false;
  return PENDING_LIFECYCLE_STATUSES.has(state.lifecycle);
}

export function isTransactionFailureState(state: TransactionStateSnapshot | null | undefined): boolean {
  if (!state) return false;
  if (state.execution === TX_EXECUTION_STATUS.Failed) {
    return true;
  }
  return FAILED_LIFECYCLE_STATUSES.has(state.lifecycle);
}

export function isTransactionSuccessfulState(state: TransactionStateSnapshot | null | undefined): boolean {
  if (!state || isTransactionFailureState(state)) {
    return false;
  }
  return SUCCESSFUL_LIFECYCLE_STATUSES.has(state.lifecycle);
}

export function getTransactionSummaryStatus(state: TransactionStateSnapshot | null | undefined): TxStatusValue {
  if (isTransactionFailureState(state)) {
    return TX_STATUS.Failed;
  }

  if (isTransactionPendingState(state)) {
    return TX_STATUS.Pending;
  }

  return TX_STATUS.Confirmed;
}

export function getTransactionDetailStatus(state: TransactionStateSnapshot | null | undefined): TransactionDetailBadgeStatus {
  if (isTransactionFailureState(state)) {
    return 'failed';
  }

  if (state?.lifecycle === TX_LIFECYCLE_STATUS.Finalized) {
    return 'finalized';
  }

  if (isTransactionPendingState(state)) {
    return 'pending';
  }

  return 'confirmed';
}

export function getTransactionDetailLabelStatus(state: TransactionStateSnapshot | null | undefined): TransactionDetailLabelStatus {
  const status = getTransactionDetailStatus(state);
  return status === 'finalized' ? 'confirmed' : status;
}
