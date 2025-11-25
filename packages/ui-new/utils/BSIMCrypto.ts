import { computeHmac, randomBytes } from 'ethers';
import { BSIM_DEV_KEY } from './BSIMConstants';
import * as Hex from 'ox/Hex';
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function generateIV(): Uint8Array {
  return randomBytes(16);
}

/**
 * Encrypt ICCID using HMAC-SHA256 and XOR
 * @param iccid ICCID string (e.g., "110A985802031280889979F1")
 * @param iv 16-byte random IV
 * @returns Encrypted hex string (lowercase)
 */
export function encryptICCID(iccid: string, iv: Uint8Array): Hex.Hex {
  // Remove 0x prefix and trim
  let plainHex = iccid.replace(/^0x/i, '').trim();

  // Pad left with '0' if odd length
  if (plainHex.length % 2 !== 0) {
    plainHex = `0${plainHex}`;
  }

  // Convert to bytes
  const plainBuf = Hex.toBytes(`0x${plainHex}`);
  const n = plainBuf.length;

  // Generate keystream using HMAC-SHA256
  const devKeyBytes = Hex.toBytes(`0x${BSIM_DEV_KEY}`);
  const blocks = Math.ceil(n / 32);
  const keystream = new Uint8Array(blocks * 32);

  for (let i = 0; i < blocks; i++) {
    const msg =
      i === 0
        ? iv
        : (() => {
            const buf = new Uint8Array(iv.length + 1);
            buf.set(iv, 0);
            buf[buf.length - 1] = i;
            return buf;
          })();
    const keystreamHex = computeHmac('sha256', devKeyBytes, msg);
    const block = Hex.toBytes(keystreamHex as Hex.Hex);
    keystream.set(block, i * 32);
  }

  // XOR encryption
  const cipherBuf = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    cipherBuf[i] = plainBuf[i] ^ keystream[i];
  }

  return Hex.from(cipherBuf);
}

/**
 * Generate password verification tag
 * @param password User password (key2)
 * @param iv 16-byte random IV
 * @returns 2-byte tag as hex (4 characters, lowercase)
 */
export function generatePasswordTag(password: string, iv: Uint8Array): Hex.Hex {
  // Concatenate password bytes and IV
  const passwordBytes = stringToBytes(password);
  const message = new Uint8Array(passwordBytes.length + iv.length);
  message.set(passwordBytes, 0);
  message.set(iv, passwordBytes.length);

  // Compute HMAC-SHA256
  const devKeyBytes = Hex.toBytes(`0x${BSIM_DEV_KEY}`);
  const hmacHex = computeHmac('sha256', devKeyBytes, message);
  const hmacResult = Hex.toBytes(hmacHex as Hex.Hex);

  // Return first 2 bytes as hex
  return Hex.from(hmacResult.slice(0, 2));
}
