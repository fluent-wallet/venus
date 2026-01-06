import { decodeBsimDerivationSnapshot, encodeBsimDerivationSnapshot } from './BSIMDerivationSnapshot';

describe('BSIMDerivationSnapshot', () => {
  test('encode/decode round-trip', () => {
    const records = [
      { coinType: 60, index: 1, alg: 1, key: 'aa' },
      { coinType: 60, index: 2, alg: 1, key: 'bb' },
      { coinType: 60, index: 3, alg: 1, key: 'cc' },
      { coinType: 503, index: 1, alg: 1, key: 'dd' },
      { coinType: 503, index: 2, alg: 1, key: 'ee' },
      { coinType: 60, index: 0, alg: 1, key: 'ff' },
    ];

    const d = encodeBsimDerivationSnapshot(records);
    const decoded = decodeBsimDerivationSnapshot(d);

    expect(decoded).toEqual([
      { coinType: 60, alg: 1, maxIndex: 3 },
      { coinType: 503, alg: 1, maxIndex: 2 },
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

  test('encode throws on alg mismatch for same coinType', () => {
    const records = [
      { coinType: 60, index: 1, alg: 1, key: 'aa' },
      { coinType: 60, index: 2, alg: 2, key: 'bb' },
    ];
    expect(() => encodeBsimDerivationSnapshot(records)).toThrow(/Alg mismatch/i);
  });

  test('encode real records', () => {
    const records = [
      { coinType: 60, index: 1, alg: 1, key: '042A77CE729F5B08B6407D65AD1F698DD6F70396EB9FE2C4C3D46201CABB91FB55EAB3B2F700FDDE698AF53E69BC1573DA93D178DE8D6213F4DC1A8687B4A689CF' },
      { coinType: 60, index: 2, alg: 1, key: '04EA3F7A75C83BC01A25E58B0EE0F7FEFEBEA051B86C3E84AB260AE07EF91D85EE112C9DE6AE588CBF229C83E7CE51664AA862F057F28427E8F972D3B55DABE313' },
      { coinType: 60, index: 3, alg: 1, key: '042FED09E38029D1B15E86D4B526E93B3485DC32A0B8643AD215EFD8FCC56E1E7433C69B2F4B15A62909911ABCE9B8B0C1D416B5D994F6DE3D16B6967E9CD13AB1' },
      { coinType: 60, index: 4, alg: 1, key: '0451977020ABAB17574C1C0D8C7579FC682E264D63DEDDCFE7D5B41E97638F6DAE02EE2F7117A94BE4B944224B9B7B73C4B3DF3D444F2EA2D3850EA5FFE72EE11D' },
      { coinType: 60, index: 5, alg: 1, key: '04C6063F39EA2A11297383CFE5CB70BC2C0E179137A98D4692D822875138349AE51E419319E14D0566D5F5DCEA3B2B4A2DFC51AA1D4B27C594E1F7890AFAA23F32' },
    ];

    const d = encodeBsimDerivationSnapshot(records);
    expect(d).toBe('ZAEBAAAAPAEF');
    expect(decodeBsimDerivationSnapshot(d)).toEqual([{ coinType: 60, alg: 1, maxIndex: 5 }]);
  });
});
