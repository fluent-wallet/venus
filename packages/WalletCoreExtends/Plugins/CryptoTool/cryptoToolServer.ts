import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { getPasswordCryptoKey } from '@utils/getEnv';
import { injectable } from 'inversify';
import crypto from 'react-native-quick-crypto';

interface EncryptedData {
  cipher: string;
  iv: string; // hex
  salt: string;
}

/**
 * CryptoTool exposes two public methods: encrypt and decrypt
 * This is to encrypt / decrypt the data
 * which contains sensitive seed words and addresses
 */
@injectable()
export class CryptoToolServer implements ICryptoTool {
  constructor() {
    /**
     * Unlike the default exported authCryptoTool, the authCryptoTool here requires an unexposed key to store the password itself.
     * 'PASSWORD_CRYPTO_KEY' will be replaced in build.
     */
    this.setGetPasswordMethod(getPasswordCryptoKey);
  }

  private getPasswordMethod: (() => string | null) | (() => Promise<string | null>) | null = null;
  public setGetPasswordMethod = (getPasswordMethod: (() => string | null) | (() => Promise<string | null>)) => {
    this.getPasswordMethod = getPasswordMethod;
  };

  public getPassword = async () => {
    if (!this.getPasswordMethod) throw Error('CryptoTool: getPasswordMethod is not set.');
    const password = await this.getPasswordMethod();
    return password;
  };

  private generateKey = async (salt: string, keyLen = 32, password?: string): Promise<string> => {
    const pwd = password ?? (await this.getPassword());
    if (!pwd) {
      throw new Error('CryptoTool need password from settedMethod or params');
    }
    const result = crypto.pbkdf2Sync(pwd, salt, 5000, keyLen, 'sha512');
    return result.toString('base64');
  };

  private encryptWithKey = async (text: string, keyBase64: string): Promise<Pick<EncryptedData, 'cipher' | 'iv'>> => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(keyBase64, 'base64'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: Buffer.from(iv).toString('hex'),
      cipher: encrypted.toString(),
    };
  };

  private decryptWithKey = (encryptedData: EncryptedData, keyBase64: string): string => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(keyBase64, 'base64'), Buffer.from(encryptedData.iv, 'hex'));
    let decrypted = decipher.update(encryptedData.cipher, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted.toString();
  };

  public generateRandomString = (byteCount = 32) => {
    const view = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(view);
    const b64encoded = btoa(String.fromCharCode.apply(null, view as unknown as Array<number>));
    return b64encoded;
  };
  /**
   * Encrypts a JS data using a password (and AES encryption with native libraries)
   *
   * @param {object} object - Data object to encrypt
   * @returns - Promise resolving to stringified data
   */
  public encrypt = async (object: unknown, password?: string) => {
    const salt = this.generateRandomString(16);
    const key = await this.generateKey(salt, 32, password);
    const result = (await this.encryptWithKey(JSON.stringify(object), key)) as EncryptedData;
    result.salt = salt;

    return JSON.stringify(result);
  };

  /**
   * Decrypts an encrypted string (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  public decrypt = async <T = unknown>(encryptedDataString: string, password?: string): Promise<T> => {
    const encryptedData = JSON.parse(encryptedDataString) as EncryptedData;
    const key = await this.generateKey(encryptedData.salt, 32, password);
    const data = await this.decryptWithKey(encryptedData, key);
    return JSON.parse(data);
  };
}
