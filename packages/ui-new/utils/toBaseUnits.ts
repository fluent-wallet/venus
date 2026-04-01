import Decimal from 'decimal.js';

export function toBaseUnitsFromDecimalBalance(balance: string | null | undefined, decimals: number): string {
  // Keep decimal-to-base-unit conversion consistent across UI flows.
  const balanceDecimal = balance ? new Decimal(balance) : new Decimal(0);
  return balanceDecimal.mul(Decimal.pow(10, decimals)).toFixed(0);
}
