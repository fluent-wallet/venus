import { decodeBsimDerivationSnapshot, encodeBsimDerivationSnapshot } from './BSIMDerivationSnapshot';

describe('BSIMDerivationSnapshot', () => {
  test('encode/decode round-trip (runs)', () => {
    const records = [
      { coinType: 60, index: 1, alg: 1, key: 'aa' },
      { coinType: 60, index: 2, alg: 1, key: 'bb' },
      { coinType: 60, index: 3, alg: 1, key: 'cc' },
      { coinType: 503, index: 4, alg: 1, key: 'dd' },
      { coinType: 503, index: 5, alg: 1, key: 'ee' },
      { coinType: 60, index: 0, alg: 1, key: 'ff' },
    ];

    const d = encodeBsimDerivationSnapshot(records);
    const decoded = decodeBsimDerivationSnapshot(d);

    expect(decoded).toEqual([
      { coinType: 60, alg: 1, count: 3 },
      { coinType: 503, alg: 1, count: 2 },
    ]);
  });

  test('decode empty string', () => {
    expect(decodeBsimDerivationSnapshot('')).toEqual([]);
    expect(decodeBsimDerivationSnapshot('   ')).toEqual([]);
  });

  test('decode invalid magic', () => {
    expect(() => decodeBsimDerivationSnapshot('ZQEA')).toThrow(/magic/i);
  });

  test('decode length mismatch', () => {
    expect(() => decodeBsimDerivationSnapshot('ZAEB')).toThrow(/length/i);
  });

  test('encode preserves algorithm changes as separate runs', () => {
    const records = [
      { coinType: 60, index: 1, alg: 1, key: 'aa' },
      { coinType: 60, index: 2, alg: 2, key: 'bb' },
    ];

    const d = encodeBsimDerivationSnapshot(records);
    expect(decodeBsimDerivationSnapshot(d)).toEqual([
      { coinType: 60, alg: 1, count: 1 },
      { coinType: 60, alg: 2, count: 1 },
    ]);
  });

  test('encode multi coinType order (96@1 then 60@2..6)', () => {
    const records = [
      { coinType: 96, index: 1, alg: 1, key: 'k1' },
      { coinType: 60, index: 2, alg: 1, key: 'k2' },
      { coinType: 60, index: 3, alg: 1, key: 'k3' },
      { coinType: 60, index: 4, alg: 1, key: 'k4' },
      { coinType: 60, index: 5, alg: 1, key: 'k5' },
      { coinType: 60, index: 6, alg: 1, key: 'k6' },
    ];

    const d = encodeBsimDerivationSnapshot(records);
    expect(d).toBe('ZAECAAAAYAEBAAAAPAEF');
    expect(decodeBsimDerivationSnapshot(d)).toEqual([
      { coinType: 96, alg: 1, count: 1 },
      { coinType: 60, alg: 1, count: 5 },
    ]);
  });
});
