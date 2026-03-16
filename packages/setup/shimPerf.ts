import { hmacSha512, keccak256 } from '@metamask/native-utils';
import * as ethers from 'ethers';
import crypto from 'react-native-quick-crypto';

type HmacModule = typeof import('@noble/hashes/hmac.js');
type Pbkdf2Module = typeof import('@noble/hashes/pbkdf2.js');
type Sha3Module = typeof import('@noble/hashes/sha3.js');

type MutableHmacModule = HmacModule & {
  hmac: HmacModule['hmac'];
};

type MutableSha3Module = Sha3Module & {
  keccak_256: Sha3Module['keccak_256'];
};

const nobleHashesHmac = require('@noble/hashes/hmac.js') as MutableHmacModule;
const nobleHashesPbkdf2 = require('@noble/hashes/pbkdf2.js') as Pbkdf2Module & {
  pbkdf2: Pbkdf2Module['pbkdf2'];
};
const nobleHashesSha3 = require('@noble/hashes/sha3.js') as MutableSha3Module;

// Log native patch failures before falling back to the original JS implementation.
function logFallback(name: string, error: unknown) {
  console.warn(`[shimPerf] ${name} failed, falling back to JS implementation`, error);
}

// Identify the sha512-shaped noble hash used by hmac and pbkdf2.
function isSha512Hash(hash: { outputLen: number; blockLen: number }) {
  return hash.outputLen === 64 && hash.blockLen === 128;
}

// Register the default ethers crypto primitives with react-native-quick-crypto.
function registerEthersCrypto() {
  ethers.randomBytes.register((length) => {
    return new Uint8Array(crypto.randomBytes(length));
  });

  ethers.computeHmac.register((algo, key, data) => {
    return crypto.createHmac(algo, key).update(data).digest();
  });

  ethers.pbkdf2.register((passwd, salt, iter, keylen, algo) => {
    return crypto.pbkdf2Sync(passwd, salt, iter, keylen, algo);
  });

  ethers.sha256.register((data) => {
    return crypto.createHash('sha256').update(data).digest();
  });

  ethers.sha512.register((data) => {
    return crypto.createHash('sha512').update(data).digest();
  });
}

// Replace noble hmac(sha512, ...) with the native implementation.
function patchNobleHmac() {
  const originalHmac = nobleHashesHmac.hmac;
  const patchedHmac = ((hash, key, message) => {
    if (isSha512Hash(hash)) {
      try {
        return hmacSha512(key, message);
      } catch (error) {
        logFallback('native hmacSha512', error);
      }
    }

    return originalHmac(hash, key, message);
  }) as HmacModule['hmac'];

  Object.assign(patchedHmac, originalHmac);
  nobleHashesHmac.hmac = patchedHmac;
}

// Replace noble pbkdf2(sha512, ...) with the native sync implementation.
function patchNoblePbkdf2() {
  const originalPbkdf2 = nobleHashesPbkdf2.pbkdf2;
  const patchedPbkdf2 = ((hash, password, salt, opts) => {
    if (isSha512Hash(hash)) {
      try {
        return new Uint8Array(crypto.pbkdf2Sync(password, salt, opts.c, opts.dkLen ?? 32, 'sha512'));
      } catch (error) {
        logFallback('native pbkdf2 sha512', error);
      }
    }

    return originalPbkdf2(hash, password, salt, opts);
  }) as Pbkdf2Module['pbkdf2'];

  Object.assign(patchedPbkdf2, originalPbkdf2);
  nobleHashesPbkdf2.pbkdf2 = patchedPbkdf2;
}

// Replace noble keccak_256 with the native implementation.
function patchNobleKeccak() {
  const originalKeccak256 = nobleHashesSha3.keccak_256;
  const patchedKeccak256 = ((value) => {
    try {
      return keccak256(value);
    } catch (error) {
      logFallback('native keccak256', error);
    }

    return originalKeccak256(value);
  }) as Sha3Module['keccak_256'];

  Object.assign(patchedKeccak256, originalKeccak256);
  nobleHashesSha3.keccak_256 = patchedKeccak256;
}

// Register ethers keccak256 so ethers call sites use the same native path.
function registerEthersKeccak() {
  const originalKeccak256 = nobleHashesSha3.keccak_256;
  ethers.keccak256.register((data) => {
    try {
      return keccak256(data);
    } catch (error) {
      logFallback('ethers keccak256', error);
    }

    return originalKeccak256(data);
  });
}

function installShimPerf() {
  registerEthersCrypto();
  patchNobleHmac();
  patchNoblePbkdf2();
  patchNobleKeccak();
  registerEthersKeccak();
}

installShimPerf();
