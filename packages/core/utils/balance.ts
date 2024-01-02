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

export function numAbbreviation(num: number | string, options: { truncateLength?: number } = {}): string {
  const { truncateLength } = options;
  const carry = 3;
  const abbreviations = ['', '', 'M', 'B']; // 单位缩写
  // const carry = 6;
  // const abbreviations = ['', 'M', 'B']; // 单位缩写
  const numString = typeof num === 'number' ? num.toString() : num;

  const floatValue = parseFloat(numString);
  if (Number.isNaN(floatValue)) {
    return '';
  }

  const absoluteValue = Math.abs(floatValue);
  // console.log(absoluteValue);
  if (absoluteValue === 0) {
    return '0';
  }

  // if (truncateLength) {
  //   // check is less minimum value
  //   const miniValue = 1 / Math.pow(10, truncateLength);
  //   if (absoluteValue < miniValue) {
  //     return `<${miniValue}`;
  //   }
  // }

  if (absoluteValue < Math.pow(10, carry + 3)) {
    // less than 1_000_000 (1M)
    if (truncateLength && new Decimal(numString).greaterThan(new Decimal(10).pow(-truncateLength))) {
      return truncate(numString, truncateLength);
    } else {
      return numString;
    }
  }

  const sign = floatValue >= 0 ? '' : '-';

  let abbreviationIndex = Math.floor(Math.log10(absoluteValue) / carry);
  abbreviationIndex = Math.max(0, Math.min(abbreviationIndex, abbreviations.length - 1));

  const formattedNumber = absoluteValue / Math.pow(10, abbreviationIndex * carry);

  return `${sign}${truncateLength ? truncate(formattedNumber, options.truncateLength) : formattedNumber}${abbreviations[abbreviationIndex]}`;
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
