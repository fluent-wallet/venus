import crypto from 'react-native-quick-crypto';
global.getRandomValues = crypto.getRandomValues;
import * as ethers from 'ethers';

ethers.pbkdf2.register(
  (
    password: Uint8Array,
    salt: Uint8Array,
    iterations: number,
    keylen: number,
    algo: 'sha256' | 'sha512'
    // eslint-disable-next-line max-params
  ) => {
    return ethers.hexlify(crypto.pbkdf2Sync(password, salt, iterations, keylen, algo));
  }
);
