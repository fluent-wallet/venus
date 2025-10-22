import type { PubkeyRecord } from './types';

const HEX_PATTERN = /^[0-9A-F]*$/i;

export const normalizeHex = (hex: string): string => {
  if (!hex) {
    return '';
  }
  let compact = hex.replace(/\s+/g, '');
  if (compact.startsWith('0x') || compact.startsWith('0X')) {
    compact = compact.slice(2);
  }
  if (compact.length % 2 !== 0) {
    throw new Error(`Hex string must have even length: ${hex}`);
  }
  if (!HEX_PATTERN.test(compact)) {
    throw new Error(`Hex string contains non-hex characters: ${hex}`);
  }
  return compact.toUpperCase();
};

export const asciiToHex = (ascii: string): string => {
  let hex = '';
  for (let index = 0; index < ascii.length; index += 1) {
    const code = ascii.charCodeAt(index);
    if (code > 0xff) {
      throw new Error(`Non-ASCII character detected at position ${index}`);
    }
    hex += code.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
};

export const toHex = (value: Uint8Array | string): string => {
  if (typeof value === 'string') {
    return asciiToHex(value);
  }
  let hex = '';
  for (const byte of value) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
};

export const fromHex = (hex: string): Uint8Array => {
  const normalized = normalizeHex(hex);
  const buffer = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    buffer[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return buffer;
};

export const extractSignature = (hex: string) => {
  const normalized = normalizeHex(hex);
  const bytes = fromHex(normalized);

  const expectTag = (actual: number, expected: number, label: string) => {
    if (actual !== expected) {
      throw new Error(`Unexpected ${label} tag: 0x${actual.toString(16)}`);
    }
  };

  const readLength = (view: Uint8Array, start: number) => {
    const first = view[start];
    if (first < 0x80) {
      return { length: first, size: 1 };
    }
    const lengthBytes = first & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 2) {
      throw new Error(`Unsupported DER length encoding: ${first}`);
    }
    let value = 0;
    for (let i = 0; i < lengthBytes; i += 1) {
      value = (value << 8) | view[start + 1 + i];
    }
    return { length: value, size: 1 + lengthBytes };
  };

  let offset = 0;
  expectTag(bytes[offset], 0x30, 'sequence');
  offset += 1;

  const sequenceLength = readLength(bytes, offset);
  offset += sequenceLength.size;
  if (sequenceLength.length !== bytes.length - offset) {
    throw new Error('DER sequence length mismatch');
  }

  expectTag(bytes[offset], 0x02, 'R');
  offset += 1;
  const rLength = readLength(bytes, offset);
  offset += rLength.size;
  const rBytes = bytes.slice(offset, offset + rLength.length);
  offset += rLength.length;

  expectTag(bytes[offset], 0x02, 'S');
  offset += 1;
  const sLength = readLength(bytes, offset);
  offset += sLength.size;
  const sBytes = bytes.slice(offset, offset + sLength.length);

  const normalizeScalar = (scalar: Uint8Array) => {
    let trimmed = scalar.slice();
    while (trimmed.length > 0 && trimmed[0] === 0x00) {
      trimmed = trimmed.slice(1);
    }
    if (trimmed.length > 32) {
      throw new Error('Scalar component exceeds 32 bytes');
    }
    const hexScalar = toHex(trimmed);
    return hexScalar.padStart(64, '0');
  };

  return {
    r: normalizeScalar(rBytes),
    s: normalizeScalar(sBytes),
  };
};

/**
 * parse a single TLV object from the supplied (normalized) hex string.
 */
export const parseTlv = (normalized: string) => {
  if (normalized.length < 4) {
    throw new Error('TLV chunk must contain at least tag and length bytes');
  }

  const tag = normalized.slice(0, 2);
  let offset = 2;

  const firstLengthByte = Number.parseInt(normalized.slice(offset, offset + 2), 16);
  if (!Number.isFinite(firstLengthByte)) {
    throw new Error('Invalid TLV length byte');
  }
  offset += 2;

  let length = firstLengthByte;
  if ((firstLengthByte & 0x80) !== 0) {
    const lengthOctets = firstLengthByte & 0x7f;
    if (lengthOctets === 0) {
      throw new Error('Indefinite-length TLV is not supported');
    }
    const lengthHex = normalized.slice(offset, offset + lengthOctets * 2);
    if (lengthHex.length !== lengthOctets * 2) {
      throw new Error('Incomplete TLV length field');
    }
    length = Number.parseInt(lengthHex, 16);
    offset += lengthOctets * 2;
  }

  const value = normalized.slice(offset, offset + length * 2);
  if (value.length !== length * 2) {
    throw new Error(`TLV value length mismatch: expected ${length} bytes, got ${value.length / 2}`);
  }

  return { tag, length, value };
};

/**
 * parse a TLV (tag c2) exported by BSIM when listing public keys.
 */
export const parsePubkeyChunk = (hex: string): PubkeyRecord => {
  const normalized = normalizeHex(hex);
  const { tag, value } = parseTlv(normalized);

  if (tag !== 'C2') {
    throw new Error(`Unexpected TLV tag ${tag}, expected C2`);
  }
  if (value.length < 12) {
    throw new Error('Pubkey TLV payload is too short');
  }

  const coinType = Number.parseInt(value.slice(0, 8), 16) >>> 0;
  const index = Number.parseInt(value.slice(8, 10), 16);
  const alg = Number.parseInt(value.slice(10, 12), 16);

  let keyStart = 12;

  if (value.length > 14) {
    const candidateLength = Number.parseInt(value.slice(12, 14), 16);
    const remaining = value.length - 14;
    if (Number.isFinite(candidateLength) && candidateLength > 0 && candidateLength * 2 === remaining) {
      keyStart = 14;
    }
  }

  const key = value.slice(keyStart);

  if (key.length === 0 || key.length % 2 !== 0) {
    throw new Error('Invalid pubkey payload length');
  }

  return {
    coinType,
    index,
    alg,
    key,
  };
};
