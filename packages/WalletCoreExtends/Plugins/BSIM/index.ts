import BSIMSDK, { BSIM_ERRORS, BSIM_SUPPORT_ACCOUNT_LIMIT, CoinTypes } from './BSIMSDK';
import { addHexPrefix } from '@core/utils/base';
import { computeAddress } from 'ethers';
import { type Plugin } from '@core/WalletCore/Plugins';

export { CoinTypes, CFXCoinTypes } from './BSIMSDK';

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    BSIM: BSIMPluginClass;
  }
}

let hasInit = false;
const eSpaceCoinType = 60;

export class BSIMPluginClass implements Plugin {
  constructor() {
    this.getBSIMList();
  }
  name = 'BSIM' as const;

  chainLimtCount = 25 as const;

  checkIsInit = async () => {
    if (!hasInit) {
      await BSIMSDK.create();
      hasInit = true;
    }
  };

  public formatBSIMPubkey = (key: string) => {
    if (key.length === 128) {
      return key;
    }
    if (key.length === 130 && key.slice(0, 2) === '00') {
      return key.slice(2);
    }
    return key;
  };

  public getBSIMPubkeys = () => BSIMSDK.getPubkeyList();

  public getBSIMList = async () => {
    try {
      await this.checkIsInit();
      const list = await BSIMSDK.getPubkeyList();
      return list
        .map((item) => ({ hexAddress: computeAddress(addHexPrefix(this.formatBSIMPubkey(item.key))), index: item.index, coinType: item.coinType }))
        .filter((item) => item.index > 0)
        .filter((item) => item.coinType === eSpaceCoinType)
        .sort((itemA, itemB) => itemA.index - itemB.index);
    } catch (err) {
      return [];
    }
  };

  public createNewBSIMAccount = async () => {
    await this.checkIsInit();

    try {
      await BSIMSDK.genNewKey(CoinTypes.ETHEREUM);

      const list = await this.getBSIMList();

      const BSIMKey = list.at(-1);
      if (!BSIMKey) throw new Error('create new BSIM account failed');

      return { hexAddress: BSIMKey.hexAddress, index: BSIMKey.index };
    } catch (error: any) {
      if (error?.code) {
        const errorMsg = BSIM_ERRORS[error.code?.toUpperCase()] || error.message;
        throw new Error(errorMsg);
      }
      throw error;
    }
  };

  public createBSIMAccountToIndex = async (targetIndex: number) => {
    await this.checkIsInit();

    const list = await this.getBSIMList();
    const maxIndex = list.at(-1)?.index ?? -1;
    if (maxIndex >= targetIndex || maxIndex >= BSIM_SUPPORT_ACCOUNT_LIMIT) return;

    let index = maxIndex;
    do {
      index = (await this.createNewBSIMAccount()).index;
    } while (index < targetIndex);
  };

  public connectBSIM = async () => {
    await this.checkIsInit();

    const list = await this.getBSIMList();
    if (list?.length > 0) {
      return list.slice(0, 1);
    } else {
      return [await this.createNewBSIMAccount()];
    }
  };

  public verifyBPIN = async () => {
    await this.checkIsInit();

    return BSIMSDK.verifyBPIN();
  };

  public getBSIMVersion = async () => {
    await this.checkIsInit();
    return BSIMSDK.getBSIMVersion();
  };
  public signMessage = async (message: string, coinTypeIndex: number, index: number) => {
    await this.checkIsInit();

    return BSIMSDK.signMessage(message, coinTypeIndex, index);
  };
}

export default new BSIMPluginClass();
