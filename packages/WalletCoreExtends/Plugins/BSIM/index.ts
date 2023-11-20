import BSIMSDK, { CoinTypes } from './BSIMSDK';
import { addHexPrefix } from '@core/utils/base';
import { computeAddress } from 'ethers';
import { type Plugin } from '@core/WalletCore/Plugins';

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    BSIM: BSIMPluginClass;
  }
}

const formatBSIMPubkey = (key: string) => {
  if (key.length === 128) {
    return key;
  }
  if (key.length === 130 && key.slice(0, 2) === '00') {
    return key.slice(2);
  }
  return key;
};

let hasInit = false;

export class BSIMPluginClass implements Plugin {
  name = 'BSIM' as const;

  public getBIMList = async () => {
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

  public createNewBSIMAccount = async () => {
    if (!hasInit) {
      BSIMSDK.create('BSIM');
      hasInit = true;
    }

    const BSIMKey = await BSIMSDK.genNewKey(CoinTypes.CONFLUX);
    const pubkey = addHexPrefix(formatBSIMPubkey(BSIMKey.key));
    const hexAddress = computeAddress(pubkey);
    return { hexAddress, index: BSIMKey.index };
  };

  public createBSIMAccountToIndex = async (targetIndex: number) => {
    if (!hasInit) {
      BSIMSDK.create('BSIM');
      hasInit = true;
    }
    const list = await this.getBIMList();
    const maxIndex = list.at(-1)?.index ?? -1;
    if (maxIndex >= targetIndex) return;

    let index = maxIndex;
    do {
      index = (await this.createNewBSIMAccount()).index;
    } while (index < targetIndex);
  };

  public connectBSIM = async () => {
    if (!hasInit) {
      BSIMSDK.create('BSIM');
      hasInit = true;
    }

    try {
      const list = await this.getBIMList();
      if (list?.length > 0) {
        return list.slice(0, 1);
      }
    } catch (error) {
      return [await this.createNewBSIMAccount()];
    }
    return [await this.createNewBSIMAccount()];
  };
}

export default new BSIMPluginClass();
