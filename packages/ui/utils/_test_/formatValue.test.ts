import { formatValue } from '../formatValue';

describe('test formatValue with string value and decimals is 18', () => {
  test('1e18 should be 1', () => {
    const value = '1000000000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1');
  });
  test('1e16 should be 0.01', () => {
    const value = '10000000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('0.01');
  });
  test('1e14 should be 0.0001', () => {
    const value = '100000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('0.0001');
  });

  test('1e12 should be <0.0001', () => {
    const value = '1000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('<0.0001');
  });

  test('1e25 should be 1M', () => {
    const value = '1000000000000000000_0000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1M');
  });
  test('1e28 should be 1B', () => {
    const value = '1000000000000000000_0000000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1B');
  });
  test('1e27 should be 100M', () => {
    const value = '1000000000000000000_000000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('100M');
  });

  test('1e33 should be 100000B', () => {
    const value = '1000000000000000000_000000000000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('100000B');
  });


  test('1234000000000000000 should be 1.234', () => {
    const value = '1234000000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1.234');
  });

  test('1234500000000000000 should be 1.2345', () => {
    const value = '1234500000000000000';
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1.2345');
  });

  test('1234500000000000000_0000000 should be 1.2345M', () => {
    const value = '1234500000000000000_0000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1.2345M');
  });
  test('1234500000000000000_0000000000 should be 1.2345B', () => {
    const value = '1234500000000000000_0000000000'.replace('_', '');
    const decimals = 18;

    const result = formatValue(value, decimals);
    expect(result).toBe('1.2345B');
  });
});

describe('test formatValue with string value and decimals is 3', () => {
  test('1000_0000000 should be 1M', () => {
    const value = '1000_0000000'.replace('_', '');
    const decimals = 3;
    const result = formatValue(value, decimals);

    expect(result).toBe('1M');
  });
  test('1000_0000000000 should be 1B', () => {
    const value = '1000_0000000000'.replace('_', '');
    const decimals = 3;
    const result = formatValue(value, decimals);

    expect(result).toBe('1B');
  });
  test('1234_0000000000 should be 1.234B', () => {
    const value = '1234_0000000000'.replace('_', '');
    const decimals = 3;
    const result = formatValue(value, decimals);

    expect(result).toBe('1.234B');
  });
  test('12345_000000000 should be 1.234B', () => {
    const value = '12345_000000000'.replace('_', '');
    const decimals = 3;
    const result = formatValue(value, decimals);

    expect(result).toBe('1.2345B');
  });

  test('1 should be 0.001', () => {
    const value = '1';
    const decimals = 3;
    const result = formatValue(value, decimals);

    expect(result).toBe('0.001');
  });
});
