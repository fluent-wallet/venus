import { extractSignature, normalizeHex, parsePubkeyChunk } from './utils';

const DER_SIGNATURE =
  '304402207F0F265E3F4FC52AE1A86410DA5C8BDAEB7C0B1032EB42B1E23FC326439BAFC502204A9AEE904027C3188D8F9C56F8EBAB223B7E555265F7C204E4290339F30B698B';
const PUBKEY_TLV = `C2470000003C020140${'EE'.repeat(64)}`;

describe('utlis', () => {
  it('normalizes hex strings', () => {
    expect(normalizeHex('aa bb cc')).toBe('AABBCC');
    expect(normalizeHex('0x0123')).toBe('0123');
    expect(() => normalizeHex('abc')).toThrow('Hex string must have even length');
    expect(() => normalizeHex('0x123')).toThrow('Hex string must have even length');
  });

  it('extracts signature components from DER payload', () => {
    expect(extractSignature(DER_SIGNATURE)).toEqual({
      r: '7F0F265E3F4FC52AE1A86410DA5C8BDAEB7C0B1032EB42B1E23FC326439BAFC5',
      s: '4A9AEE904027C3188D8F9C56F8EBAB223B7E555265F7C204E4290339F30B698B',
    });
  });

  it('parses C2 pubkey TLV chunk', () => {
    expect(parsePubkeyChunk(PUBKEY_TLV)).toEqual({
      coinType: 0x3c,
      index: 0x02,
      alg: 0x01,
      key: 'EE'.repeat(64),
    });
  });

  it('rejects mismatched pubkey length', () => {
    const broken = `C2470000003C020141${'AA'.repeat(63)}`;
    expect(() => parsePubkeyChunk(broken)).toThrow(/TLV value length mismatch/);
  });
});
