import crypto from 'react-native-quick-crypto';

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

  private generateKey = async (salt: string): Promise<string> => {
    const result = crypto.pbkdf2Sync(await this.getPassword(), salt, 5000, 256);
    return result.toString('hex');
  };

  private encryptWithKey = (text: string, key: string) => {
    const aes = crypto.createCipher('aes-256-cbc', key);
    let str = aes.update(text);
    str += aes.final('hex');
    return str.toString();
  };

  private decryptWithKey = (encryptedData: string, key: string) => {
    const aes = crypto.createCipher('aes-256-cbc', key);
    let str = aes.update(encryptedData);
    str += aes.final('utf8');
    return str.toString();
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
  public encrypt = async (object: unknown) => {
    const salt = this.generateRandomString(16);
    console.log('encrypt salt', salt);
    try {
      const key = await this.generateKey(salt);
    } catch (error) {
      console.log('encrypt error', error);
    }
    // const result = this.encryptWithKey(JSON.stringify(object), key);
    // return JSON.stringify({
    //   cipher: result,
    //   iv: salt,
    //   salt,
    // });
  };

  /**
   * Decrypts an encrypted string (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  public decrypt = async <T = unknown>(encryptedDataString: string): Promise<T> => {
    const encryptedData = JSON.parse(encryptedDataString);
    const key = await this.generateKey(encryptedData.salt);
    const data = this.decryptWithKey(encryptedData, key);
    return JSON.parse(data);
  };
}

export const cryptoTool = new CryptoTool();
