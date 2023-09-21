import { NativeModules } from 'react-native';
const Aes = NativeModules.Aes;
const AesForked = NativeModules.AesForked;

/**
 * Class that exposes two public methods: Encrypt and Decrypt
 * This is to encrypt / decrypt the state
 * which contains sensitive seed words and addresses
 */
class Encrypt {
  key = null;

  generateRandomStr(byteCount = 32) {
    const view = new Uint8Array(byteCount);
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Crypto/getRandomValues
    global.crypto.getRandomValues(view);
    // eslint-disable-next-line no-undef
    const b64encoded = btoa(String.fromCharCode.apply(null, view as unknown as Array<number>));
    return b64encoded;
  }

  _generateKey = (password: string, salt: string, lib: 'original') =>
    lib === 'original' ? Aes.pbkdf2(password, salt, 5000, 256) : AesForked.pbkdf2(password, salt);

  _keyFromPassword = (password: string, salt: string, lib: 'original') => this._generateKey(password, salt, lib);

  _encryptWithKey = async (text: string, keyBase64: string) => {
    const iv = await Aes.randomKey(16);
    return Aes.encrypt(text, keyBase64, iv).then((cipher: string) => ({ cipher, iv }));
  };

  _decryptWithKey = (encryptedData: any, key: string, lib: 'original') =>
    lib === 'original' ? Aes.decrypt(encryptedData.cipher, key, encryptedData.iv) : AesForked.decrypt(encryptedData.cipher, key, encryptedData.iv);

  /**
   * Encrypts a JS object using a password (and AES encryption with native libraries)
   *
   * @param {string} password - Password used for encryption
   * @param {object} object - Data object to encrypt
   * @returns - Promise resolving to stringified data
   */
  encrypt = async (password: string, object: any) => {
    const salt = this.generateRandomStr(16);
    const key = await this._keyFromPassword(password, salt, 'original');
    const result = await this._encryptWithKey(JSON.stringify(object), key);
    result.salt = salt;
    result.lib = 'original';
    return JSON.stringify(result);
  };

  /**
   * Decrypts an encrypted JS object (encryptedString)
   * using a password (and AES decryption with native libraries)
   *
   * @param {string} password - Password used for decryption
   * @param {string} encryptedString - String to decrypt
   * @returns - Promise resolving to decrypted data object
   */
  decrypt = async (password: string, encryptedString: string) => {
    const encryptedData = JSON.parse(encryptedString);
    const key = await this._keyFromPassword(password, encryptedData.salt, encryptedData.lib);
    const data = await this._decryptWithKey(encryptedData, key, encryptedData.lib);
    return JSON.parse(data);
  };
}

export default new Encrypt();