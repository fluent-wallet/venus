import { formatUnits } from 'ethers';

const fixed = (string: string) => {
  const [int, dec] = string.split('.');
  if (dec) {
    const d = dec.slice(0, 4);

    const t = Number(`0.${d}`);
    
    if (int === '0' && t === 0) {
      return '<0.0001';
    } else {
      return `${int}${t === 0 ? '' : `.${d}`}`;
    }
  } else {
    return int;
  }
};

export const formatValue = (value: string | number | bigint, decimals = 18) => {
  if (decimals === 0) return fixed(formatUnits(value, decimals));

  const v = BigInt(value) / BigInt(10 ** decimals);
  const b = BigInt(1e10);
  const m = BigInt(1e7);

  if (v >= b) {
    return `${fixed(formatUnits(value, decimals + 10))}B`;
  }

  if (v >= m) {
    return `${fixed(formatUnits(value, decimals + 7))}M`;
  }
  console.log(value, value, formatUnits(value, decimals));
  return fixed(formatUnits(value, decimals));
};
