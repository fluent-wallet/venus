import { randomInt } from './base';
import { HDNode, entropyToMnemonic } from '@ethersproject/hdnode';
import { randomBytes } from 'ethers';
import { memoize } from 'lodash-es';

const DEFAULT_HD_PATH = `m/44'/503'/0'/0`;

export const generateMnemonic = () => entropyToMnemonic(randomBytes(16));

export const defHDKey = memoize((mnemonic: string) => {
  const hdnode = HDNode.fromMnemonic(mnemonic);
  hdnode.derivePath = memoize(hdnode.derivePath);
  return hdnode;
});

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
  const result = {} as { address: string; privateKey: string; index: number };
  const k = defHDKey(mnemonic);

  if (only0x1Prefixed) {
    let count = 0,
    idx = 0;
    while (count <= nth) {
      paths[5] = `${idx++}`;
      const newNode = k.derivePath(paths.join('/'));
      result.address = newNode.address.toLowerCase();
      result.privateKey = newNode.privateKey;
      if (result.address.startsWith('0x1')) count++;
    }
    result.index = idx - 1;
  } else {
    paths[5] = String(nth);
    const newNode = k.derivePath(paths.join('/'));
    result.address = newNode.address.toLowerCase();
    result.privateKey = newNode.privateKey;
    result.index = nth;
  }

  return result;
};
