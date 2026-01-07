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
 * Encode BSIM derivation state to base64url for backup QR.
 *
 * BSIM index is a global slot shared by all coinTypes. On restore we must replay
 * derivations in order, otherwise addresses won't match the backup.
 *
 * Encoding:
 * 1. Drop index=0 (sentinel)
 * 2. Sort by index, require contiguous 1..N
 * 3. RLE consecutive (coinType, alg)
 * 4. Serialize to bytes, convert to base64url
 *
 * Binary format (v1):
 *   [0]    magic     = 0x64 ('d')
 *   [1]    version   = 0x01
 *   [2]    runCount  = u8
 *   per run (6 bytes): coinType(u32 BE) + alg(u8) + count(u8)
 *
 * Example (index 1 -> coinType 96; index 2~6 -> coinType 60):
 *
 *   bytes (hex): 64 01 02  00 00 00 60 01 01  00 00 00 3c 01 05
 *
 *   [0]   [1]   [2]         [3][4][5][6]           [7]  [8]            [9][10][11][12]   [13]  [14]
 *  +-----+-----+-----+  +--------------------------+-----+-----+  +--------------------------+-----+-----+
 *  |0x64 |0x01 |0x02 |  | coinType=96 (0x00000060) |alg=1|cnt=1|  | coinType=60 (0x0000003C) |alg=1|cnt=5|
 *  +-----+-----+-----+  +--------------------------+-----+-----+  +--------------------------+-----+-----+
 *    ^     ^     ^                ^                ^     ^                ^                ^     ^
 *    |     |     |                |                |     |                |                |     |
 *   magic ver  runs            run[0]             alg  count           run[1]             alg  count
 *
 *   -> base64url: "ZAECAAAAYAEBAAAAPAEF"
 */
export const encodeBsimDerivationSnapshot = (records: PubkeyRecord[]): string => {
  // Map global BSIM `index` -> (coinType, alg), used to preserve derive order.
  const byIndex = new Map<number, { coinType: number; alg: number }>();

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
    if (byIndex.has(r.index)) {
      throw new Error(`Duplicate index: ${r.index}`);
    }

    byIndex.set(r.index, { coinType: r.coinType, alg: r.alg });
  }

  const sorted = Array.from(byIndex.entries())
    .map(([index, v]) => ({ index, coinType: v.coinType, alg: v.alg }))
    .sort((a, b) => a.index - b.index);

  // Require 1..N contiguous indexes so restore can safely replay in order.
  for (let i = 0; i < sorted.length; i += 1) {
    const expected = i + 1;
    if (sorted[i].index !== expected) {
      throw new Error(`Index gap: expected ${expected}, got ${sorted[i].index}`);
    }
  }

  const runs: Array<{ coinType: number; alg: number; count: number }> = [];
  for (const item of sorted) {
    const last = runs.at(-1);
    if (last && last.coinType === item.coinType && last.alg === item.alg) {
      last.count += 1;
      if (last.count > U8_MAX) throw new Error(`Run too long: ${last.count}`);
    } else {
      runs.push({ coinType: item.coinType, alg: item.alg, count: 1 });
    }
  }

  if (runs.length > U8_MAX) {
    throw new Error('Too many runs');
  }

  const bytes: number[] = [MAGIC, FORMAT_VERSION, runs.length];

  for (const run of runs) {
    const [b0, b1, b2, b3] = encodeU32BE(run.coinType);
    bytes.push(b0, b1, b2, b3, run.alg, run.count);
  }

  return toBase64Url(bytesToBase64(new Uint8Array(bytes)));
};

export type DerivationRun = {
  coinType: number;
  alg: number;
  count: number;
};
/**
 * Decode derivation snapshot from backup QR.
 * Returns empty array if input is empty.
 */
export const decodeBsimDerivationSnapshot = (d: string): DerivationRun[] => {
  if (!d?.trim()) return [];

  const bytes = fromBase64Url(d.trim());
  if (bytes.length < 3) throw new Error('Snapshot too short');

  if (bytes[0] !== MAGIC) throw new Error('Invalid magic');
  if (bytes[1] !== FORMAT_VERSION) throw new Error(`Unsupported version: ${bytes[1]}`);

  const runCount = bytes[2];
  const expectedLen = 3 + runCount * ENTRY_SIZE;
  if (bytes.length < expectedLen) throw new Error('Length mismatch');

  const runs: DerivationRun[] = [];
  let offset = 3;

  for (let i = 0; i < runCount; i += 1) {
    const count = bytes[offset + 5];
    if (count <= 0) throw new Error('Invalid run count');

    runs.push({
      coinType: readU32BE(bytes, offset),
      alg: bytes[offset + 4],
      count,
    });
    offset += ENTRY_SIZE;
  }

  return runs;
};
