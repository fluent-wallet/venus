import { TX_EXECUTION_STATUS, TX_LIFECYCLE_STATUS, type TransactionStateSnapshot } from '@core/types';
import {
  TX_STATUS,
  getTransactionDetailLabelStatus,
  getTransactionDetailStatus,
  getTransactionSummaryStatus,
  isTransactionFailureState,
  isTransactionPendingState,
  isTransactionSuccessfulState,
} from './transactionStatus';

const makeState = (state: Partial<TransactionStateSnapshot>): TransactionStateSnapshot => ({
  lifecycle: TX_LIFECYCLE_STATUS.Pending,
  execution: TX_EXECUTION_STATUS.Unknown,
  ...state,
});

describe('transactionStatus helpers', () => {
  it('preserves finalized for detail status while keeping summary confirmed', () => {
    const state = makeState({
      lifecycle: TX_LIFECYCLE_STATUS.Finalized,
      execution: TX_EXECUTION_STATUS.Succeeded,
    });

    expect(getTransactionDetailStatus(state)).toBe('finalized');
    expect(getTransactionDetailLabelStatus(state)).toBe('confirmed');
    expect(getTransactionSummaryStatus(state)).toBe(TX_STATUS.Confirmed);
    expect(isTransactionSuccessfulState(state)).toBe(true);
  });

  it('treats executed failure as failed across all presenters', () => {
    const state = makeState({
      lifecycle: TX_LIFECYCLE_STATUS.Executed,
      execution: TX_EXECUTION_STATUS.Failed,
    });

    expect(getTransactionDetailStatus(state)).toBe('failed');
    expect(getTransactionSummaryStatus(state)).toBe(TX_STATUS.Failed);
    expect(isTransactionFailureState(state)).toBe(true);
    expect(isTransactionSuccessfulState(state)).toBe(false);
  });

  it('treats temp replaced as pending for speed-up related logic', () => {
    const state = makeState({
      lifecycle: TX_LIFECYCLE_STATUS.TempReplaced,
    });

    expect(isTransactionPendingState(state)).toBe(true);
    expect(getTransactionSummaryStatus(state)).toBe(TX_STATUS.Pending);
  });

  it('treats replaced as terminal failure for summary logic', () => {
    const state = makeState({
      lifecycle: TX_LIFECYCLE_STATUS.Replaced,
    });

    expect(isTransactionFailureState(state)).toBe(true);
    expect(getTransactionSummaryStatus(state)).toBe(TX_STATUS.Failed);
  });
});
