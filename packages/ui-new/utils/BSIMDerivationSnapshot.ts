import type { PubkeyRecord } from 'react-native-bsim';

const U8_MAX = 255;
const MAGIC = 0x64; // 'd'
const FORMAT_VERSION = 0x01;
const ENTRY_SIZE = 6;

const toBase64Url = (base64: string): string => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const fromBase64Url = (input: string): Uint8Array => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(padLen)}`;

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const encodeU32BE = (value: number) => {
  const v = value >>> 0;
  return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff] as const;
};

const readU32BE = (bytes: Uint8Array, offset: number): number => {
  if (offset < 0 || offset + 4 > bytes.length) throw new Error('Read out of bounds');
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
};

/**
 * Encode derivation snapshot for backup QR.
 *
 * Records which coinTypes have been derived to which index,
 * so after seed restore we can re-derive the same addresses.
 *
 * Format:
 *   byte[0] = 0x64 (magic 'd')
 *   byte[1] = 0x01 (format version)
 *   byte[2] = count (number of entries, u8)
 *   then 6 bytes per entry:
 *     coinType  (u32 big-endian)
 *     alg       (u8)
 *     maxIndex  (u8)
 */
export const encodeBsimDerivationSnapshot = (records: PubkeyRecord[]): string => {
  const coinTypes = new Map<number, { alg: number; maxIndex: number }>();

  for (const r of records) {
    // BSIM uses index=0 as a sentinel (not an exported/usable account).
    if (r.index === 0) continue;
    if (!Number.isInteger(r.index) || r.index < 0 || r.index > U8_MAX) {
      throw new Error(`Invalid index: ${r.index}`);
    }
    if (!Number.isInteger(r.coinType) || r.coinType < 0 || r.coinType > 0xffffffff) {
      throw new Error(`Invalid coinType: ${r.coinType}`);
    }
    if (!Number.isInteger(r.alg) || r.alg < 0 || r.alg > U8_MAX) {
      throw new Error(`Invalid alg: ${r.alg}`);
    }

    const existing = coinTypes.get(r.coinType);
    if (!existing) {
      coinTypes.set(r.coinType, { alg: r.alg, maxIndex: r.index });
      continue;
    }

    if (existing.alg !== r.alg) {
      throw new Error(`Alg mismatch for coinType ${r.coinType}`);
    }

    if (r.index > existing.maxIndex) {
      existing.maxIndex = r.index;
    }
  }

  const entries = Array.from(coinTypes.entries())
    .map(([coinType, v]) => ({ coinType, alg: v.alg, maxIndex: v.maxIndex }))
    .sort((a, b) => a.coinType - b.coinType);

  if (entries.length > U8_MAX) {
    throw new Error('Too many coinTypes');
  }

  const bytes: number[] = [MAGIC, FORMAT_VERSION, entries.length];

  for (const e of entries) {
    const [b0, b1, b2, b3] = encodeU32BE(e.coinType);
    bytes.push(b0, b1, b2, b3, e.alg, e.maxIndex);
  }

  return toBase64Url(bytesToBase64(new Uint8Array(bytes)));
};

export type DerivationEntry = {
  coinType: number;
  alg: number;
  maxIndex: number;
};

/**
 * Decode derivation snapshot from backup QR.
 * Returns empty array if input is empty.
 */
export const decodeBsimDerivationSnapshot = (d: string): DerivationEntry[] => {
  if (!d?.trim()) return [];

  const bytes = fromBase64Url(d.trim());
  if (bytes.length < 3) throw new Error('Snapshot too short');

  if (bytes[0] !== MAGIC) throw new Error('Invalid magic');
  if (bytes[1] !== FORMAT_VERSION) throw new Error(`Unsupported version: ${bytes[1]}`);

  const count = bytes[2];
  const expectedLen = 3 + count * ENTRY_SIZE;
  if (bytes.length < expectedLen) throw new Error('Length mismatch');

  const entries: DerivationEntry[] = [];
  let offset = 3;

  for (let i = 0; i < count; i += 1) {
    entries.push({
      coinType: readU32BE(bytes, offset),
      alg: bytes[offset + 4],
      maxIndex: bytes[offset + 5],
    });
    offset += ENTRY_SIZE;
  }

  return entries;
};
