import { bytesToHex } from '@noble/hashes/utils.js';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';
import { randomBytes } from 'ethers';
import { memoize } from 'lodash-es';
import { computeAddress } from './account';
import { randomInt } from './base';

const DEFAULT_HD_PATH = `m/44'/503'/0'/0`;

type HDKeyWithDerivePath = HDKey & {
  derivePath: (path: string) => HDKey;
};

export const generateMnemonic = () => entropyToMnemonic(randomBytes(16), englishWordlist);

export const defHDKey = memoize((mnemonic: string): HDKeyWithDerivePath => {
  const hdkey = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic));
  const derivePath = memoize((path: string) => hdkey.derive(path));
  return Object.assign(hdkey, { derivePath });
});

const getAddressFromPublicKey = (publicKey: Uint8Array): string => {
  return computeAddress(`0x${bytesToHex(publicKey)}`).toLowerCase();
};

function randomHDPathIndex() {
  return randomInt(0x80000000);
}

export const randomHDPath = () => {
  return `m/44'/${randomHDPathIndex()}'/${randomHDPathIndex()}'/${randomInt(randomHDPathIndex())}`;
};

export const validateHDPath = (hdPath: string) => {
  let valid = true;
  try {
    const paths = hdPath.split('/');
    valid = valid && paths.length === 5 && paths[0] === 'm' && paths[1] === "44'" && paths[2].endsWith("'") && paths[3].endsWith("'");
    valid = valid && Boolean(defHDKey(generateMnemonic()).derivePath(paths.join('/')));
  } catch (err) {
    valid = false;
  }

  return valid;
};

export const getNthAccountOfHDKey = async ({
  mnemonic,
  hdPath = DEFAULT_HD_PATH,
  nth,
  only0x1Prefixed = false,
}: {
  mnemonic: string;
  hdPath?: string | undefined;
  nth: number;
  only0x1Prefixed?: boolean | undefined;
}) => {
  const paths = hdPath.split('/');
  const result = {} as { hexAddress: string; privateKey: string; index: number };
  const k = defHDKey(mnemonic);

  if (only0x1Prefixed) {
    let count = 0,
      idx = 0;
    while (count <= nth) {
      paths[5] = `${idx++}`;
      const newNode = k.derivePath(paths.join('/'));
      if (!newNode.privateKey || !newNode.publicKey) {
        throw new Error('Derived HD key does not contain a public/private key pair.');
      }
      result.privateKey = `0x${bytesToHex(newNode.privateKey)}`;
      result.hexAddress = getAddressFromPublicKey(newNode.publicKey);
      if (result.hexAddress.startsWith('0x1')) count++;
    }
    result.index = idx - 1;
  } else {
    paths[5] = String(nth);
    const newNode = k.derivePath(paths.join('/'));
    if (!newNode.privateKey || !newNode.publicKey) {
      throw new Error('Derived HD key does not contain a public/private key pair.');
    }
    result.privateKey = `0x${bytesToHex(newNode.privateKey)}`;
    result.hexAddress = getAddressFromPublicKey(newNode.publicKey);
    result.index = nth;
  }

  return result;
};
