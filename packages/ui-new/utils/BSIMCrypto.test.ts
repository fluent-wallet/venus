import { generateIV, encryptICCID, generatePasswordTag, verifyPasswordTag } from './BSIMCrypto';
import { BSIM_DEV_KEY } from './BSIMConstants';
import { Hex } from 'ox';
import { stripHexPrefix } from '@core/utils/base';

describe('BSIMCrypto', () => {
  describe('generateIV', () => {
    test('generates 16-byte IV', () => {
      const iv = generateIV();
      expect(iv).toBeInstanceOf(Uint8Array);
      expect(iv.length).toBe(16);
    });
  });

  describe('encryptICCID', () => {
    test('encrypts with fixed IV', () => {
      const iccid = '110A985802031280889979F1';
      const iv = new Uint8Array(16).fill(0x00);
      const encrypted = encryptICCID(iccid, iv);
      expect(encrypted).toBe('0x3ba65569e08de8ee01ab4ba5');
    });

    test('encrypts odd length ICCID', () => {
      const iccid = '110A985802031280889959F5A';
      const iv = new Uint8Array(16).fill(0x00);
      const encrypted = encryptICCID(iccid, iv);

      expect(encrypted).toBe('0x2bbc64b462aecb4681bba7cb7e');
    });

    test('produces different results with different IVs', () => {
      const iccid = '110A985802031280889979F1';
      const encrypted1 = encryptICCID(iccid, new Uint8Array(16).fill(0x00));
      const encrypted2 = encryptICCID(iccid, new Uint8Array(16).fill(0x01));

      expect(encrypted1).not.toBe(encrypted2);
    });

    test('produces consistent results', () => {
      const iccid = '110A985802031280889979F1';
      const iv = new Uint8Array(16).fill(0x00);

      expect(encryptICCID(iccid, iv)).toBe(encryptICCID(iccid, iv));
    });

    test('handles 0x prefix', () => {
      const encrypted = encryptICCID('0x110A985802031280889979F1', new Uint8Array(16).fill(0x00));
      expect(encrypted).toBe('0x3ba65569e08de8ee01ab4ba5');
    });

    test('handles whitespace', () => {
      const encrypted = encryptICCID('  110A985802031280889979F1  ', new Uint8Array(16).fill(0x00));
      expect(encrypted).toBe('0x3ba65569e08de8ee01ab4ba5');
    });

    test('encrypts ICCID longer than 32 bytes', () => {
      const iccid = '0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324252627';
      const iv = new Uint8Array(16).fill(0x00);
      const encrypted = encryptICCID(iccid, iv);

      expect(encrypted).toBe('0x2aadcf32e68bfc69813b385f28ffd648d1d23ddf44fe4a781db56ff40d95dd11f82c0887256d3988');
    });
  });

  describe('generatePasswordTag', () => {
    test('generates tag with fixed IV', () => {
      const password = 'TestPassword123!';
      const iv = new Uint8Array(16).fill(0x00);
      const tag = generatePasswordTag(password, iv);

      expect(tag).toBe('0xd1d2');
    });

    test('generates different tags for different passwords', () => {
      const iv = new Uint8Array(16).fill(0x00);
      const tag1 = generatePasswordTag('password1', iv);
      const tag2 = generatePasswordTag('password2', iv);

      expect(tag1).not.toBe(tag2);
      expect(tag1).toBe('0xe19d');
      expect(tag2).toBe('0xe984');
    });

    test('generates different tags for different IVs', () => {
      const password = 'TestPassword123!';
      const tag1 = generatePasswordTag(password, new Uint8Array(16).fill(0x00));
      const tag2 = generatePasswordTag(password, new Uint8Array(16).fill(0x01));

      expect(tag1).not.toBe(tag2);
    });

    test('generates consistent tags', () => {
      const password = 'TestPassword123!';
      const iv = new Uint8Array(16).fill(0x00);

      expect(generatePasswordTag(password, iv)).toBe(generatePasswordTag(password, iv));
    });

    test('handles empty password', () => {
      const tag = generatePasswordTag('', new Uint8Array(16).fill(0x00));
      expect(tag).toBe('0x2aac');
    });

    test('handles unicode password', () => {
      const tag = generatePasswordTag('123123123', new Uint8Array(16).fill(0x00));
      expect(tag).toBe('0x853e');
    });
  });

  describe('Integration', () => {
    test('creates complete QR payload', () => {
      const iv = new Uint8Array(16).fill(0x00);
      const iccid_ct = encryptICCID('110A985802031280889979F1', iv);
      const pwd_tag = generatePasswordTag('MyPassword123!', iv);

      const payload = {
        v: 1,
        version: '1.0.0',
        seed_ct: 'a1b2c3d4e5f6',
        iv: Hex.from(iv),
        iccid_ct,
        pwd_tag,
      };

      expect(payload.v).toBe(1);
      expect(payload.version).toBe('1.0.0');
      expect(payload.seed_ct).toBe('a1b2c3d4e5f6');
      expect(payload.iv).toBe('0x00000000000000000000000000000000');
      expect(payload.iccid_ct).toBe('0x3ba65569e08de8ee01ab4ba5');
      expect(payload.pwd_tag).toBe('0x9aca');
    });

    test('verifies Dev Key is configured', () => {
      expect(BSIM_DEV_KEY).toBeDefined();
      expect(BSIM_DEV_KEY.length).toBe(64);
      expect(BSIM_DEV_KEY).toMatch(/^[0-9a-fA-F]{64}$/);
    });
  });
});

describe('verifyPasswordTag', () => {
  test('returns true when password/tag match', () => {
    const password = 'MyPassword123!';
    const iv = new Uint8Array(16).fill(0x00);
    const payload = {
      iv: stripHexPrefix(Hex.from(iv)).toLowerCase(),
      pwd_tag: stripHexPrefix(generatePasswordTag(password, iv)).toLowerCase(),
    };

    expect(verifyPasswordTag(password, payload)).toBe(true);
  });

  test('returns false when password is wrong', () => {
    const iv = new Uint8Array(16).fill(0x00);
    const payload = {
      iv: stripHexPrefix(Hex.from(iv)).toLowerCase(),
      pwd_tag: stripHexPrefix(generatePasswordTag('correctPass123', iv)).toLowerCase(),
    };

    expect(verifyPasswordTag('wrongPass123', payload)).toBe(false);
  });

  test('handles mixed-case tag and iv', () => {
    const password = 'TestPassword123!';
    const iv = new Uint8Array(16).fill(0x01);
    const payload = {
      iv: stripHexPrefix(Hex.from(iv)).toUpperCase(), // intentionally upper
      pwd_tag: stripHexPrefix(generatePasswordTag(password, iv)).toUpperCase(),
    };

    expect(verifyPasswordTag(password, payload)).toBe(true);
  });

  test('returns false on invalid iv payload', () => {
    const payload = {
      iv: 'zzzz', // invalid hex
      pwd_tag: 'dead',
    };

    expect(verifyPasswordTag('anything', payload)).toBe(false);
  });
});
