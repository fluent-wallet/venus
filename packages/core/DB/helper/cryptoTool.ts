import { NativeModules } from 'react-native';
const Aes = NativeModules.Aes;
const AesForked = NativeModules.AesForked;

interface EncryptedData {
  cipher: string;
  iv: string;
  salt: string;
  lib: 'original';
}

/**
 * CryptoTool exposes two public methods: encrypt and decrypt
 * This is to encrypt / decrypt the data
 * which contains sensitive seed words and addresses
 */
export class CryptoTool {
  private getPasswordMethod: (() => string | null) | (() => Promise<string | null>) | null = null;
  public setGetPasswordMethod = (getPasswordMethod: (() => string | null) | (() => Promise<string | null>)) => (this.getPasswordMethod = getPasswordMethod);

  private getPassword = async () => {
    if (!this.getPasswordMethod) throw Error('CryptoTool: getPasswordMethod is not set.');
    const password = await this.getPasswordMethod();
    if (!password) throw Error('CryptoTool: password is not set.');
    return password;
  };

  private generateKey = async (salt: string, lib: 'original'): Promise<string> =>
    lib === 'original' ? Aes.pbkdf2(await this.getPassword(), salt, 5000, 256) : AesForked.pbkdf2(await this.getPassword(), salt);

  private encryptWithKey = async (text: string, keyBase64: string): Promise<Pick<EncryptedData, 'cipher' | 'iv'>> => {
    const iv = await Aes.randomKey(16);
    return Aes.encrypt(text, keyBase64, iv).then((cipher: string) => ({ cipher, iv }));
  };

  private decryptWithKey = (encryptedData: EncryptedData, key: string, lib: 'original'): Promise<string> =>
    lib === 'original' ? Aes.decrypt(encryptedData.cipher, key, encryptedData.iv) : AesForked.decrypt(encryptedData.cipher, key, encryptedData.iv);

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
  public encrypt = async (object: unknown) => {
    const salt = this.generateRandomString(16);
    const key = await this.generateKey(salt, 'original');
    const result = (await this.encryptWithKey(JSON.stringify(object), key)) as EncryptedData;
    result.salt = salt;
    result.lib = 'original';
    return JSON.stringify(result);
  };

  /**
   * Decrypts an encrypted string (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  public decrypt = async <T = unknown>(encryptedDataString: string): Promise<T> => {
    const encryptedData = JSON.parse(encryptedDataString) as EncryptedData;
    const key = await this.generateKey(encryptedData.salt, encryptedData.lib);
    const data = await this.decryptWithKey(encryptedData, key, encryptedData.lib);
    return JSON.parse(data);
  };
}

export const cryptoTool = new CryptoTool();
