import Decimal from 'decimal.js';

export const numberFormat = (num: string | number | null | undefined, decimals = 6) => {
  if (num === null || num === undefined || num === '') return '';
  return numberWithCommas(trimDecimalZeros(truncate(num, decimals)));
};

export const trimDecimalZeros = (numStr: string | number) => {
  if (typeof numStr !== 'string' && typeof numStr !== 'number') {
    return numStr;
  }
  const _str = String(numStr);
  return _str.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0*$/, '');
};

export const numberWithCommas = (x: number | string) => {
  const idx = String(x ?? '').indexOf('.');
  return idx !== -1
    ? String(x ?? '')
        .slice(0, idx)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',') + x.toString().slice(idx)
    : String(x ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
export const truncate = (number: string | number, decimals = 6) => {
  const unit = new Decimal(number);
  if (
    (unit.lessThan(new Decimal(`1e-${decimals}`)) && unit.greaterThanOrEqualTo(0)) ||
    (unit.greaterThan(new Decimal(`-1e-${decimals}`)) && unit.lessThanOrEqualTo(0))
  )
    return '0';
  const numberString = String(number);
  const dotIndex = numberString.indexOf('.');

  if (dotIndex === -1) {
    return numberString;
  }

  const endIndex = dotIndex + decimals + 1;
  let truncatedString = numberString.substring(0, endIndex);
  if (endIndex === numberString.length) {
    return truncatedString;
  }

  while (truncatedString.endsWith('0')) {
    truncatedString = truncatedString.slice(0, -1);
  }
  while (truncatedString.endsWith('.')) {
    truncatedString = truncatedString.slice(0, -1);
  }
  return truncatedString;
};

export function numAbbreviation(
  num: number | string | bigint,
  options: { truncateLength?: number; toPrecision?: number; toExpPos?: number; precision?: number } = {},
): string {
  const { truncateLength, toExpPos, toPrecision, precision } = options;
  const carry = 3;
  const abbreviations = ['', '', 'M', 'B']; // 单位缩写
  // const carry = 6;
  // const abbreviations = ['', 'M', 'B']; // 单位缩写
  const numString = num.toString();

  const value = new Decimal(numString);

  const defaultExpPos = Decimal.toExpPos;
  const defaultPrecision = Decimal.precision;

  if (precision) {
    Decimal.set({
      precision,
    });
  }

  if (toExpPos) {
    Decimal.set({
      toExpPos,
    });
  }

  if (value.isZero()) {
    return '0';
  }

  if (value.lessThan(new Decimal(10).pow(carry + 3))) {
    // less than 1_000_000 (1M)

    if (truncateLength && value.greaterThan(new Decimal(10).pow(-truncateLength))) {
      return truncate(numString, truncateLength);
    }
    return numString;
  }
  const sign = value.isNegative() ? '-' : '';
  const absoluteValue = value.abs();
  let abbreviationIndex = Decimal.floor(absoluteValue.logarithm(10).div(carry));

  // let abbreviationIndex = Math.floor(Math.log10(absoluteValue) / carry);
  abbreviationIndex = Decimal.max(0, Decimal.min(abbreviationIndex, abbreviations.length - 1));
  // abbreviationIndex = Math.max(0, Math.min(abbreviationIndex, abbreviations.length - 1));
  // const formattedNumber = absoluteValue / Math.pow(10, abbreviationIndex * carry);
  const formattedNumber = absoluteValue.div(new Decimal(10).pow(abbreviationIndex.times(carry)));

  const result = `${sign}${truncateLength ? truncate(formattedNumber.toPrecision(toPrecision || undefined), options.truncateLength) : formattedNumber.toPrecision(toPrecision || undefined)}${abbreviations[abbreviationIndex.toNumber()]}`;

  Decimal.set({ toExpPos: defaultExpPos, precision: defaultPrecision });

  return result;
}

const ten = new Decimal(10);
const decimalsArray = Array.from({ length: 25 }, (_, index) => ten.pow(new Decimal(index)));
export const convertBalanceToDecimal = (balance: string | number | null | undefined, decimals = 18) => {
  if (!balance) return '0';
  return new Decimal(balance).div(decimals <= 24 ? decimalsArray[decimals] : ten.pow(new Decimal(decimals))).toString();
};

interface balanceFormatOptions {
  decimals?: number; // default 18
  truncateLength?: number; // default 4
}

export const balanceFormat = (balance: string | number | null | undefined, { decimals = 18, truncateLength = 4 }: balanceFormatOptions = {}) => {
  return numAbbreviation(trimDecimalZeros(convertBalanceToDecimal(balance, decimals)), { truncateLength });
};
