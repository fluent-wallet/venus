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
      await BSIMSDK.create();
      hasInit = true;
    }
    const list = await BSIMSDK.getPubkeyList(true);
    return list
      .map((item) => ({ hexAddress: computeAddress(addHexPrefix(formatBSIMPubkey(item.key))), index: item.index }))
      .sort((itemA, itemB) => itemA.index - itemB.index);
  } catch (err) {
    return [];
  }
};

export const createNewBSIMAccount = async () => {
  if (!hasInit) {
    await BSIMSDK.create();
    hasInit = true;
  }

  await BSIMSDK.genNewKey(CoinTypes.CONFLUX);

  const list = await getBIMList();

  const BSIMKey = list.pop();
  if (!BSIMKey) throw new Error('create new BSIM account failed');

  const pubkey = addHexPrefix(formatBSIMPubkey(BSIMKey.hexAddress));
  const hexAddress = computeAddress(pubkey);
  return { hexAddress, index: BSIMKey.index };
};

export const createBSIMAccountToIndex = async (targetIndex: number) => {
  if (!hasInit) {
    await BSIMSDK.create();
    hasInit = true;
  }
  const list = await getBIMList();
  const maxIndex = list.at(-1)?.index ?? -1;
  if (maxIndex >= targetIndex) return;

  let index = maxIndex;
  do {
    index = (await createNewBSIMAccount()).index;
  } while (index < targetIndex);
};

export const connectBSIM = async () => {
  if (!hasInit) {
    await BSIMSDK.create();
    hasInit = true;
  }

  try {
    const list = await getBIMList();
    if (list?.length > 0) {
      return list.slice(0, 1);
    }
  } catch (error) {
    return [await createNewBSIMAccount()];
  }
  return [await createNewBSIMAccount()];
};
