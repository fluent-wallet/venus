import { Signature as NobleSignature, etc as secpUtils } from '@noble/secp256k1';
import { computeAddress, SigningKey } from 'ethers';
import { BSIMHardwareError } from '../errors/BSIMHardwareError';
import { parseHex } from './hexUtils';

/**
 * Canonicalizes ECDSA signature S value to lower half of curve order (EIP-2 compliant)
 * @param r - R component of signature (hex string)
 * @param s - S component of signature (hex string)
 * @returns Canonical S value as uppercase hex string without 0x prefix
 */
export const canonicalizeSignature = (r: string, s: string): string => {
  const compact = new Uint8Array(64);
  compact.set(secpUtils.hexToBytes(parseHex(r).padStart(64, '0')), 0);
  compact.set(secpUtils.hexToBytes(parseHex(s).padStart(64, '0')), 32);
  const normalized = NobleSignature.fromCompact(compact).normalizeS();
  return secpUtils.bytesToHex(normalized.toCompactRawBytes().slice(32)).toUpperCase();
};

/**
 * Resolves ECDSA recovery parameter (v) from signature and expected public key/address
 * Tries both v=0 and v=1, returns the one that recovers to target public key
 * @param digest - Message digest that was signed (hex string)
 * @param r - R component of signature (hex string)
 * @param s - S component of signature (hex string)
 * @param targetPublicKey - Expected public key (hex string)
 * @param address - Optional expected address for fallback verification
 * @returns {v, s} where v is 27 or 28 (Ethereum convention) and s is canonical
 * @throws BSIMHardwareError with code 'RECOVERY_FAILED' if neither v value recovers correctly
 */
export const resolveRecoveryParam = (digest: string, r: string, s: string, targetPublicKey: string, address?: string): { v: number; s: string } => {
  const normalizedTarget = parseHex(targetPublicKey);
  const normalizedAddress = address?.toLowerCase();
  const canonicalS = canonicalizeSignature(r, s);
  const candidates: Array<0 | 1> = [0, 1];
  for (const candidate of candidates) {
    try {
      const recovered = SigningKey.recoverPublicKey(digest, {
        r: `0x${parseHex(r)}`,
        s: `0x${canonicalS}`,
        v: candidate,
      });
      if (parseHex(recovered) === normalizedTarget) {
        return { v: candidate + 27, s: canonicalS };
      }
      if (normalizedAddress && computeAddress(recovered).toLowerCase() === normalizedAddress) {
        return { v: candidate + 27, s: canonicalS };
      }
    } catch {
      // try next candidate
    }
  }
  throw new BSIMHardwareError('RECOVERY_FAILED', 'Failed to derive recovery parameter from BSIM signature.');
};
