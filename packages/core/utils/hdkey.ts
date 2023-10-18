import { randomInt } from './base';
import { HDNode, entropyToMnemonic } from '@ethersproject/hdnode';
import { randomBytes } from 'ethers';

const DEFAULT_HD_PATH = `m/44'/503'/0'/0`;

export const generateMnemonic = () => entropyToMnemonic(randomBytes(16));

export const defHDKey = (mnemonic: string) => {
  const hdnode = HDNode.fromMnemonic(mnemonic);
  return hdnode;
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
    valid = valid && Boolean(HDNode.fromMnemonic(generateMnemonic()).derivePath(paths.join('/')));
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
  const k = defHDKey(mnemonic);
  const paths = hdPath.split('/');
  const result = {} as { address: string; privateKey: string; index: number };
  let count = 0,
    idx = 0;

  while (count <= nth) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    paths[5] = `${idx++}`;
    const newNode = k.derivePath(paths.join('/'));
    result.address = newNode.address.toLowerCase();
    result.privateKey = newNode.privateKey;
    if (only0x1Prefixed && result.address.startsWith('0x1')) count++;
    if (!only0x1Prefixed) count++;
  }
  result.index = idx - 1;

  return result;
};
