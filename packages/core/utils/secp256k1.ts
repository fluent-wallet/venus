import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { stripHexPrefix } from './base';

const CURVE_ORDER = secp256k1.Point.Fn.ORDER;

export const isValidPrivateKeyHex = (value: string): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const privateKeyHex = stripHexPrefix(value.trim());
  if (!privateKeyHex) {
    return false;
  }

  try {
    return secp256k1.utils.isValidSecretKey(hexToBytes(privateKeyHex));
  } catch {
    return false;
  }
};

export const canonicalizeSecp256k1SignatureS = (r: string, s: string): string => {
  const compactSignature = new Uint8Array(64);
  compactSignature.set(hexToBytes(r.padStart(64, '0')), 0);
  compactSignature.set(hexToBytes(s.padStart(64, '0')), 32);

  const signature = secp256k1.Signature.fromBytes(compactSignature);
  // (r, s) and (r, n - s) verify equally; Ethereum requires the low-s form.
  const lowS = signature.hasHighS() ? CURVE_ORDER - signature.s : signature.s;
  const canonicalSignature = new secp256k1.Signature(signature.r, lowS, signature.recovery);

  return bytesToHex(canonicalSignature.toBytes('compact').slice(32)).toUpperCase();
};
