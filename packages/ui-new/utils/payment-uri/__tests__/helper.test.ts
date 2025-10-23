import { bigIntToExponential, toPlainString } from '../helpers';

describe('helpers', () => {
  test('toPlainString converts scientific notation', () => {
    expect(toPlainString('1.23e-2')).toBe('0.0123');
    expect(toPlainString('1.23e+4')).toBe('12300');
    expect(toPlainString('123.456e-1')).toBe('12.3456');
    expect(toPlainString('0.001e-2')).toBe('0.00001');
    expect(toPlainString('0.001e+2')).toBe('0.1');
    expect(toPlainString('5e+6')).toBe('5000000');
  });

  test('bigIntToExponential formats bigint', () => {
    expect(bigIntToExponential(BigInt(123))).toBe('1.23e2');
    expect(bigIntToExponential(BigInt(1000000000))).toBe('1e9');
  });
});
