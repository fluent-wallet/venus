import { bigIntToExponential, toPlainString } from '../helpers';

describe('helpers', () => {
  test('toPlainString converts scientific notation', () => {
    expect(toPlainString('1.23e-2')).toBe('0.0123');
    expect(toPlainString('1.23e+4')).toBe('12300');
  });

  test('bigIntToExponential formats bigint', () => {
    expect(bigIntToExponential(BigInt(123))).toBe('1.23e2');
    expect(bigIntToExponential(BigInt(1000000000))).toBe('1e9');
  });
});
