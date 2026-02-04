import type { CryptoTool, PasswordProvider } from '@core/types/crypto';
import { cbc } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { Buffer } from 'buffer';

type EncryptedData = {
  cipher: string;
  iv: string;
  salt: string;
};

export type CryptoToolServerOptions = {
  passwordProvider?: PasswordProvider;
};

export class CryptoToolServer implements CryptoTool {
  private readonly passwordProvider?: PasswordProvider;

  constructor(options: CryptoToolServerOptions = {}) {
    this.passwordProvider = options.passwordProvider;
  }

  public generateRandomString(byteCount = 32): string {
    const bytes = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64');
  }

  private async resolvePassword(password?: string): Promise<string> {
    if (typeof password === 'string' && password.length > 0) return password;

    const provided = await this.passwordProvider?.getPassword();
    if (typeof provided === 'string' && provided.length > 0) return provided;

    throw new Error('CryptoToolServer: password is required (provide password param or PasswordProvider).');
  }

  private async deriveKey(salt: string, password?: string): Promise<Uint8Array> {
    const pwd = await this.resolvePassword(password);
    return pbkdf2(sha512, utf8ToBytes(pwd), utf8ToBytes(salt), { c: 5000, dkLen: 32 });
  }

  public async encrypt(data: unknown, password?: string): Promise<string> {
    const salt = this.generateRandomString(16);
    const key = await this.deriveKey(salt, password);

    const ivBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(ivBytes);

    const plaintext = utf8ToBytes(JSON.stringify(data));
    const ciphertextBytes = cbc(key, ivBytes).encrypt(plaintext);

    const payload: EncryptedData = {
      cipher: bytesToHex(ciphertextBytes),
      iv: bytesToHex(ivBytes),
      salt,
    };

    return JSON.stringify(payload);
  }

  public async decrypt<T = unknown>(encryptedDataString: string, password?: string): Promise<T> {
    const encryptedData = JSON.parse(encryptedDataString) as EncryptedData;

    const key = await this.deriveKey(encryptedData.salt, password);
    const ivBytes = hexToBytes(encryptedData.iv);
    const ciphertextBytes = hexToBytes(encryptedData.cipher);

    const plaintextBytes = cbc(key, ivBytes).decrypt(ciphertextBytes);

    return JSON.parse(Buffer.from(plaintextBytes).toString('utf8')) as T;
  }
}
