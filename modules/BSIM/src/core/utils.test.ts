import { extractSignature, normalizeHex, parsePubkeyChunk } from './utils';

const DER_SIGNATURE =
  '3045022100F3949D7B92917A23C54D76FAA6DDD4D41E25385443F078DAC3F88FC5BE6FD7F002205550E2C1A28FDB1A698E6AD1F1B12D3093387DA71903C0CC1AA7DC21D2997D0D';
const PUBKEY_TLV = `C2470000003C020140${'EE'.repeat(64)}`;

describe('utlis', () => {
  it('normalizes hex strings', () => {
    expect(normalizeHex('aa bb cc')).toBe('AABBCC');
    expect(() => normalizeHex('abc')).toThrow('Hex string must have even length');
  });

  it('extracts signature components from DER payload', () => {
    expect(extractSignature(DER_SIGNATURE)).toEqual({
      r: 'F3949D7B92917A23C54D76FAA6DDD4D41E25385443F078DAC3F88FC5BE6FD7F0',
      s: '5550E2C1A28FDB1A698E6AD1F1B12D3093387DA71903C0CC1AA7DC21D2997D0D',
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
