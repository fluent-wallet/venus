import BSIMSDK, { CoinTypes } from '@core/BSIMSDK';
import { addHexPrefix } from '@core/utils/base';
import { computeAddress } from 'ethers';

let hasInit = false;

const formatBSIMPubkey = (key: string) => {
  if (key.length === 128) {
    return key;
  }
  if (key.length === 130 && key.slice(0, 2) === '00') {
    return key.slice(2);
  }
  return key;
};

export const getBIMList = async () => {
  try {
    if (!hasInit) {
      BSIMSDK.create('BSIM');
      hasInit = true;
    }
    const list = (await BSIMSDK.getPubkeyList()).filter((item) => item.coinType === CoinTypes.CONFLUX);
    return list
      .map((item) => ({ hexAddress: computeAddress(addHexPrefix(formatBSIMPubkey(item.key))), index: item.index }))
      .sort((itemA, itemB) => itemA.index - itemB.index);
  } catch (err) {
    return [];
  }
};

export const createNewBSIMAccount = async () => {
  if (!hasInit) {
    BSIMSDK.create('BSIM');
    hasInit = true;
  }

  const BSIMKey = await BSIMSDK.genNewKey(CoinTypes.CONFLUX);
  const pubkey = addHexPrefix(formatBSIMPubkey(BSIMKey.key));
  const hexAddress = computeAddress(pubkey);
  return { hexAddress, index: BSIMKey.index };
};

export const connectBSIM = async () => {
  if (!hasInit) {
    BSIMSDK.create('BSIM');
    hasInit = true;
  }

  try {
    const list = await getBIMList();
    if (list?.length > 0) {
      return list;
    }
  } catch (error) {
    return [await createNewBSIMAccount()];
  }
  return [await createNewBSIMAccount()];
};
