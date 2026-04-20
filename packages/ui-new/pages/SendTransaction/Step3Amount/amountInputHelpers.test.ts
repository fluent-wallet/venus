import { getLocalMaxInputAmount, getTransferPrecheckQueryErrorTranslationKey } from './amountInputHelpers';

describe('amount input helpers', () => {
  it('uses owned nft amount for local max input', () => {
    expect(
      getLocalMaxInputAmount({
        balanceBaseUnits: '1000000000000000000',
        decimals: 18,
        ownedNftAmount: '7',
      }),
    ).toBe('7');
  });

  it('converts fungible balance base units to local max input amount', () => {
    expect(
      getLocalMaxInputAmount({
        balanceBaseUnits: '1234500',
        decimals: 6,
      }),
    ).toBe('1.2345');
  });

  it('maps timeout-like failures to network error copy', () => {
    expect(getTransferPrecheckQueryErrorTranslationKey(new Error('request timed out'))).toBe('tx.confirm.error.network');
  });

  it('falls back to estimate error copy for non-network failures', () => {
    expect(getTransferPrecheckQueryErrorTranslationKey(new Error('unexpected response shape'))).toBe('tx.amount.error.estimate');
  });
});
