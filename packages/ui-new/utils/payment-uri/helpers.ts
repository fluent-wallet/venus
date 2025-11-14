export const splitOnce = (value: string, delimiter: string): [string, string | undefined] => {
  const index = value.indexOf(delimiter);
  if (index === -1) return [value, undefined];
  return [value.slice(0, index), value.slice(index + delimiter.length)];
};

export const toPlainString = (num: string | number): string => {
  const str = typeof num === 'string' ? num : String(num);
  const match = str.match(/^(-?)(\d+)(?:\.(\d*))?e([+-]?\d+)$/i);

  if (!match) {
    return str;
  }

  const [, sign, intPartRaw, fracPartRaw, exponent] = match;
  const intPart = intPartRaw || '0';
  const fracPart = fracPartRaw || '';
  const exp = Number.parseInt(exponent, 10);

  const combinedDigits = intPart + fracPart;
  if (combinedDigits.length === 0 || /^0+$/.test(combinedDigits)) {
    return '0';
  }

  const digits = combinedDigits.replace(/^0+/, '') || '0';
  const decimalShift = exp - fracPart.length;

  if (decimalShift >= 0) {
    const integerPart = (digits + '0'.repeat(decimalShift)).replace(/^0+/, '') || '0';
    return `${sign}${integerPart}`;
  }

  const dotIndex = digits.length + decimalShift;

  if (dotIndex > 0) {
    const integer = digits.slice(0, dotIndex) || '0';
    const fraction = digits.slice(dotIndex);
    return `${sign}${integer}.${fraction}`;
  }

  const leadingZerosCount = Math.abs(dotIndex);
  const fractional = `${'0'.repeat(leadingZerosCount)}${digits}`;
  return `${sign}0.${fractional}`;
};

export const bigIntToExponential = (value: bigint): string => {
  if (typeof value !== 'bigint') {
    throw new Error(`Expected bigint, received ${typeof value}.`);
  }
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  const exponent = digits.length - 1;
  if (exponent === 0) {
    return `${negative ? '-' : ''}${digits}e0`;
  }
  const mantissaDigits = digits.replace(/(0+)$/, '');
  const mantissa = mantissaDigits.length > 1 ? `${mantissaDigits[0]}.${mantissaDigits.slice(1)}` : mantissaDigits[0];
  return `${negative ? '-' : ''}${mantissa}e${exponent}`;
};
