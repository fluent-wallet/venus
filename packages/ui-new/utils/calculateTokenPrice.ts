import { truncate } from '@core/utils/balance';
import Decimal from 'decimal.js';
import { parseUnits } from 'ethers';

/**
 * 
 * @param price  truncate(
        new Decimal(assetsHash[hashKey].priceInUSDT!)
          .mul(new Decimal(assetsHash[hashKey].balance).div(Decimal.pow(new Decimal(10), new Decimal(assetsHash[hashKey].decimals ?? 0))))
          .toString(),
        2,
      )
 * @returns 
 */

export type CalculateTokenPriceParams = {
  /**
   * token price in usdt
   */
  price?: number | string | bigint | null;
  /**
   * token amount
   * e.g. 1cfx or 1eth
   */
  amount?: number | string | bigint | null;

  /**
   * save formatted decimals length
   * @default 2
   */
  fixedDecimals?: number;
  /**
   *
   */
  formatted?: boolean;
};

export type CalculateTokenPriceReturn = null | string;

export function calculateTokenPrice({ price, amount, fixedDecimals: formattedDecimals = 2}: CalculateTokenPriceParams) {
  console.log(price, amount);
  if (!price) return null;
  if (!amount) return null;

  const _price = price.toString();
  const _amount = amount.toString();
  const priceUSDT = new Decimal(_price);
  const amountDecimal = new Decimal(_amount);
  const result = priceUSDT.mul(amountDecimal);

  return truncate(result.toString(), formattedDecimals);
}
