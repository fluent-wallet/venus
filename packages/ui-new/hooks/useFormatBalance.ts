import { useMemo } from 'react';
import Decimal from 'decimal.js';
import { balanceFormat, convertBalanceToDecimal, numberWithCommas } from '@core/utils/balance';

const useFormatBalance = (balance: string | undefined | null, decimals?: number | undefined) =>
  useMemo(() => {
    if (!balance) return '0';
    if (!decimals) return numberWithCommas(balance);
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
