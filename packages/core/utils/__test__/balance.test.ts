import { balanceFormat, convertBalanceToDecimal, numAbbreviation, numberWithCommas, trimDecimalZeros, truncate } from '../balance';

describe('balance', () => {
  test('trimDecimalZeros', () => {
    expect(trimDecimalZeros('0.000000')).toBe('0');
    expect(trimDecimalZeros('-0.000000')).toBe('-0');
    expect(trimDecimalZeros('0.000000100')).toBe('0.0000001');
  });

  test('numberWithCommas', () => {
    expect(numberWithCommas(123456789)).toBe('123,456,789');
    expect(numberWithCommas('123456789')).toBe('123,456,789');
    expect(numberWithCommas('123456789.123456789')).toBe('123,456,789.123456789');
    expect(numberWithCommas('123456789.123456')).toBe('123,456,789.123456');
    expect(numberWithCommas('123456789.123456000')).toBe('123,456,789.123456000');
    expect(numberWithCommas('123456789.1234560000')).toBe('123,456,789.1234560000');
  });

  test('truncate', () => {
    expect(truncate('0.0001002', 6)).toBe('0.00010');
    expect(truncate('0.0001002', 4)).toBe('0.0001');
    expect(truncate('0.0001002', 2)).toBe('0');
    expect(truncate('0.0001002', 1)).toBe('0');
    expect(truncate('100000000000000000.1', 1)).toBe('100000000000000000.1');
    expect(truncate('100000000000000000.123456789', 4)).toBe('100000000000000000.1234');
  });
  test('numAbbreviation', () => {
    expect(numAbbreviation(-1)).toBe('-1');
    expect(numAbbreviation(-10)).toBe('-10');
    expect(numAbbreviation(10)).toBe('10');
    expect(numAbbreviation('100')).toBe('100');
    expect(numAbbreviation('1000')).toBe('1000');
    expect(numAbbreviation('1000000')).toBe('1M');
    expect(numAbbreviation(1_000_000)).toBe('1M');
    expect(numAbbreviation(1_000_000_000)).toBe('1B');
    expect(numAbbreviation(10_000_000_000)).toBe('10B');
    expect(numAbbreviation(100_000_000_000)).toBe('100B');
    expect(numAbbreviation(1_000_000_000_000)).toBe('1000B');
    expect(numAbbreviation(1_111_000_000)).toBe('1.111B');
    expect(numAbbreviation(1_111_111_000)).toBe('1.111111B');
    expect(numAbbreviation(1_000_111_111_000)).toBe('1000.111111B');
  });

  test('convertBalanceToDecimal', () => {
    expect(convertBalanceToDecimal('1_000_000_000_000_000_000')).toBe('1');
    expect(convertBalanceToDecimal('1_000_000_000_000_000_000', 18)).toBe('1');
    expect(convertBalanceToDecimal('1_000_000_000_000_000_000', 6)).toBe('1000000000000');
    expect(convertBalanceToDecimal('1_000_000_000_000_000_000', 4)).toBe('100000000000000');
    expect(convertBalanceToDecimal('1_000_000_000_000_000_000', 2)).toBe('10000000000000000');
    expect(convertBalanceToDecimal('1_111_112_000_000_000_000', 18)).toBe('1.111112');
    expect(convertBalanceToDecimal('1_234_567_000_000_000_000')).toBe('1.234567');
    expect(convertBalanceToDecimal('1000_000_000_000_000_000_000', 18)).toBe('1000');
    expect(convertBalanceToDecimal('10_000_000_000_000_000_000_000', 18)).toBe('10000');
  });

  test('balanceFormat', () => {
    expect(balanceFormat('0')).toBe('0');
    expect(balanceFormat('110_000_000_000_00')).toBe('<0.0001');
    expect(balanceFormat('10_000_000_000_000_000', { truncateLength: 2 })).toBe('0.01');
    expect(balanceFormat('10_000_000_000_000_00', { truncateLength: 2 })).toBe('<0.01');
    expect(balanceFormat('110_000_000_000_000')).toBe('0.0001');
    expect(balanceFormat('1_000_000_000_000_000')).toBe('0.001');
    expect(balanceFormat('10_000_000_000_000_000')).toBe('0.01');
    expect(balanceFormat('100_000_000_000_000_000')).toBe('0.1');
    expect(balanceFormat('1_000_000_000_000_000_000')).toBe('1');
    expect(balanceFormat('1_234_500_000_000_000_000')).toBe('1.2345');
    expect(balanceFormat('1_234_567_000_000_000_000')).toBe('1.2345');
    expect(balanceFormat('1_000_000_000_000_000_000_000')).toBe('1000');
    expect(balanceFormat('10_000_000_000_000_000_000_000')).toBe('10000');
    expect(balanceFormat('1000_000_000_000_000_000_000_000')).toBe('1M');
    expect(balanceFormat('1234_000_000_000_000_000_000_000')).toBe('1.234M');
    expect(balanceFormat('1234_500_000_000_000_000_000_000')).toBe('1.2345M');
    expect(balanceFormat('1234_560_000_000_000_000_000_000')).toBe('1.2345M');
    expect(balanceFormat('1234_567_000_000_000_000_000_000')).toBe('1.2345M');
    expect(balanceFormat('10_000_000_000_000_000_000_000_000')).toBe('10M');
    expect(balanceFormat('100_000_000_000_000_000_000_000_000')).toBe('100M');
    expect(balanceFormat('1000_000_000_000_000_000_000_000_000')).toBe('1B');
    expect(balanceFormat('10_000_000_000_000_000_000_000_000_000')).toBe('10B');
    expect(balanceFormat('100_000_000_000_000_000_000_000_000_000')).toBe('100B');
    expect(balanceFormat('1_000_000_000_000_000_000_000_000_000_000')).toBe('1000B');
  });
});
