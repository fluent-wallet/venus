import BSIMSDK, { BSIMError, BSIMErrorEndTimeout, BSIM_ERRORS, BSIM_SUPPORT_ACCOUNT_LIMIT, CoinTypes } from './BSIMSDK';
import { addHexPrefix } from '@core/utils/base';
import { Signature, Transaction, TypedDataDomain, TypedDataEncoder, TypedDataField, computeAddress, hashMessage, hexlify } from 'ethers';
import { type Plugin } from '@core/WalletCore/Plugins';
import { Subject, catchError, defer, firstValueFrom, from, retry, throwError, timeout } from 'rxjs';
import { TxEvent, TxEventTypesName } from './types';

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
        .sort((itemA, itemB) => itemA.index - itemB.index)
        .map((item, index) => ({ ...item, index }));
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
  public BSIMSignMessage = async (message: string, coinTypeIndex: number, index: number) => {
    await this.checkIsInit();

    return BSIMSDK.signMessage(message, coinTypeIndex, index);
  };

  public updateBPIN = async () => {
    await this.checkIsInit();
    return BSIMSDK.updateBPIN();
  };

  private BSIMSign = async (hash: string, fromAddress: string) => {
    try {
      await this.verifyBPIN();
    } catch (error: any) {
      if (error?.code && error.code === 'A000') {
        console.log("get error code A000, it's ok");
        // ignore A000 error by verifyBPIN function
      } else {
        throw new BSIMError(error.code, error.message);
      }
    }

    let errorMsg = '';
    let errorCode = '';
    // retrieve the R S V of the transaction through a polling mechanism
    const pubkeyList = await this.getBSIMPubkeys();
    const currentPubkey = pubkeyList.find((item) => computeAddress(addHexPrefix(this.formatBSIMPubkey(item.key))) === fromAddress);

    if (!currentPubkey) {
      throw new Error("Can't get current pubkey from BSIM card");
    }

    const res = await firstValueFrom(
      defer(() => from(this.BSIMSignMessage(hash, currentPubkey.coinType, currentPubkey.index))).pipe(
        catchError((err: { code: string; message: string }) => {
          errorMsg = err.message;
          errorCode = err.code;
          return throwError(() => err);
        }),
        retry({ delay: 1000 }),
        timeout({ each: 30 * 1000, with: () => throwError(() => new BSIMErrorEndTimeout(errorCode, errorMsg)) }),
      ),
    );

    return res;
  };

  public signTransaction = async (fromAddress: string, tx: Transaction) => {
    const hash = tx.unsignedHash;
    const res = await this.BSIMSign(hash, fromAddress);
    tx.signature = Signature.from({ r: res.r, s: res.s, v: res.v });
    // get the transaction encoded
    const encodeTx = tx.serialized;
    return encodeTx;
  };

  public signMessage = async (message: string, fromAddress: string) => {
    const hash = hashMessage(message);
    const res = await this.BSIMSign(hash, fromAddress);
    const signature = Signature.from({ r: res.r, s: res.s, v: res.v });
    return signature.serialized;
  };

  public signTypedData = async (domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>, fromAddress: string) => {
    const hash = TypedDataEncoder.hash(domain, types, value);
    const res = await this.BSIMSign(hash, fromAddress);
    const signature = Signature.from({ r: res.r, s: res.s, v: res.v });
    return signature.serialized;
  };
}

export default new BSIMPluginClass();
