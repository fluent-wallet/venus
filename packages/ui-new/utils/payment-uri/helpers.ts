export const splitOnce = (value: string, delimiter: string): [string, string | undefined] => {
  const index = value.indexOf(delimiter);
  if (index === -1) return [value, undefined];
  return [value.slice(0, index), value.slice(index + delimiter.length)];
};

export const toPlainString = (num: string | number) =>
  ('' + +num).replace(/(-?)(\d*)\.?(\d*)e([+-]\d+)/, (a, b, c, d, e) =>
    e < 0 ? `${b}0.${Array(1 - e - c.length).join('')}${c}${d}` : `${b}${c}${d}${Array(e - d.length + 1).join('')}`,
  );

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
