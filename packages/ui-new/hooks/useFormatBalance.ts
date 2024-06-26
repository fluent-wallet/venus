import { balanceFormat, convertBalanceToDecimal, numberWithCommas } from '@core/utils/balance';
import Decimal from 'decimal.js';
import { useMemo } from 'react';

const useFormatBalance = (balance: string | undefined | null, decimals?: number | undefined) =>
  useMemo(() => {
    if (typeof balance !== 'string') return '0';
    if (typeof decimals !== 'number') return numberWithCommas(balance);
    const n = new Decimal(convertBalanceToDecimal(balance, decimals));
    if (n.equals(0)) {
      return '0';
    }
    if (n.lessThan(new Decimal(10).pow(-4))) {
      return '<0.0001';
    }
    return numberWithCommas(balanceFormat(balance, { decimals }));
  }, [balance, decimals]);

export default useFormatBalance;
