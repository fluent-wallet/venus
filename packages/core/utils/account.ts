import { computeAddress as _computeAddress, getAddress as toChecksumAddress, Wallet } from 'ethers';
import { flow, memoize } from 'lodash-es';
import { addHexPrefix, randomInt } from './base';
import { ADDRESS_TYPES, INTERNAL_CONTRACTS_HEX_ADDRESS, NULL_HEX_ADDRESS } from './consts';

const ADDRESS_TYPES_ARR = Object.values(ADDRESS_TYPES);

export const computeAddress = memoize(_computeAddress);

export const create = (pk?: string) => {
  const kp = pk ? new Wallet(pk) : Wallet.createRandom();
  return kp;
};

export const toChecksum = flow(addHexPrefix, toChecksumAddress);
export const convertToChecksum = <T extends string | null | undefined>(address: T): T => (address ? toChecksum(address) : address) as T;
export const isChecksummed = flow(addHexPrefix, (addr: string) => {
  try {
    return Boolean(toChecksumAddress(addr));
  } catch (err) {
    return false;
  }
});

export const fromPrivate = (privateKey: string) => ({
  address: flow(addHexPrefix, computeAddress)(privateKey),
  privateKey: addHexPrefix(privateKey),
});

export const toAccountAddress = (address: string) => {
  return address.replace(/^0x./, '0x1');
};

export const toContractAddress = (address: string) => {
  return address.replace(/^0x./, '0x8');
};

export const randomHexAddress = (type: ADDRESS_TYPES, checksum = false) => {
  if (type !== ADDRESS_TYPES.user && type !== ADDRESS_TYPES.builtin && type !== ADDRESS_TYPES.null && type !== ADDRESS_TYPES.contract)
    throw new Error(`Invalid address type ${type}`);
  if (type === ADDRESS_TYPES.builtin) return INTERNAL_CONTRACTS_HEX_ADDRESS[randomInt(INTERNAL_CONTRACTS_HEX_ADDRESS.length)];
  if (type === ADDRESS_TYPES.null) return NULL_HEX_ADDRESS;
  const addr = create().address;
  if (type === ADDRESS_TYPES.user) return toAccountAddress(addr);
  if (type === ADDRESS_TYPES.contract) return toContractAddress(addr);
  if (checksum) return toChecksum(addr);
  return addr;
};

export const isHexAddress = (address: string) => /^0x[0-9a-fA-F]{40}$/.test(address);
export const isUserHexAddress = (address: string) => address.startsWith('0x1');
export const isContractAddress = (address: string) => address.startsWith('0x8');
export const isBuiltInAddress = (address: string) => INTERNAL_CONTRACTS_HEX_ADDRESS.includes(address.toLowerCase());
export const isNullHexAddress = (address: string) => address === NULL_HEX_ADDRESS;
export const isCfxHexAddress = (address: string) =>
  isUserHexAddress(address) || isContractAddress(address) || isBuiltInAddress(address) || isNullHexAddress(address);

export const validateHexAddress = (address: string, type: ADDRESS_TYPES | 'eth') => {
  if (typeof address !== 'string') throw new Error('Invalid address, must be a 0x-prefixed string');
  if (!address.startsWith('0x')) throw new Error('Invalid address, must be a 0x-prefixed string');

  if (!isHexAddress(address)) return false;
  if (type === 'eth') return true;
  if (type === 'user') return isUserHexAddress(address);
  if (type === 'contract') return isContractAddress(address);
  if (type === 'builtin') return isBuiltInAddress(address);
  if (type === 'null') return isNullHexAddress(address);
  return isCfxHexAddress(address);
};

export const randomAddressType = () => {
  return ADDRESS_TYPES_ARR[randomInt(ADDRESS_TYPES_ARR.length)];
};

export const randomCfxHexAddress = () => {
  return randomHexAddress(randomAddressType());
};

export const randomPrivateKey = () => {
  return create().privateKey;
};

export const validatePrivateKey = (privateKey: string) => {
  let valid = false;
  try {
    const rst = fromPrivate(privateKey);
    valid = Boolean(rst.address);
  } catch (err) {
    valid = false;
  }

  return valid;
};
