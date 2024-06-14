import { BSIMErrorEndTimeout, BSIM_ERRORS, BSIM_SUPPORT_ACCOUNT_LIMIT, CFXCoinTypes } from './BSIMSDK';
import {
  BSIMError,
  CoinTypes,
  PublicKeyAndAddress60Type,
  genNewKey,
  getBSIMVersion,
  getPublicKeyAndAddress,
  signMessage,
  updateBPIN,
  verifyBPIN,
} from 'react-native-bsim';
import { Signature, Transaction, TypedDataDomain, TypedDataEncoder, TypedDataField, hashMessage } from 'ethers';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { type Plugin } from '@core/WalletCore/Plugins';
import { catchError, defer, firstValueFrom, from, retry, throwError, timeout, takeUntil, Subject } from 'rxjs';

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    BSIM: BSIMPluginClass;
  }
}

const eSpaceCoinType = 60;

export class BSIMPluginClass implements Plugin {
  name = 'BSIM' as const;

  chainLimitCount = 25 as const;

  public formatBSIMPubkey = (key: string) => {
    if (key.length === 128) {
      return key;
    }
    if (key.length === 130 && key.slice(0, 2) === '00') {
      return key.slice(2);
    }
    return key;
  };

  public getBSIMPublicKeys = () => getPublicKeyAndAddress();

  public getBSIMList = async () => {
    try {
      const list = await this.getBSIMPublicKeys();
      return list
        .filter((item) => item.index > 0)
        .filter((item): item is PublicKeyAndAddress60Type => item.coinType === eSpaceCoinType)
        .map((item) => ({ hexAddress: item.address, index: item.index, coinType: item.coinType }))
        .sort((itemA, itemB) => itemA.index - itemB.index)
        .map((item, index) => ({ ...item, index }));
    } catch (err) {
      return [];
    }
  };

  public createNewBSIMAccount = async () => {
    try {
      await genNewKey(CoinTypes.ETHEREUM);

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
    const list = await this.getBSIMList();
    const maxIndex = list.at(-1)?.index ?? -1;
    if (maxIndex >= targetIndex || maxIndex >= BSIM_SUPPORT_ACCOUNT_LIMIT) return;

    let index = maxIndex;
    do {
      index = (await this.createNewBSIMAccount()).index;
    } while (index < targetIndex);
  };

  public connectBSIM = async () => {
    const list = await this.getBSIMList();
    if (list?.length > 0) {
      return list.slice(0, 1);
    } else {
      return [await this.createNewBSIMAccount()];
    }
  };

  public verifyBPIN = async () => {
    return verifyBPIN();
  };

  public getBSIMVersion = async () => {
    return getBSIMVersion();
  };
  public BSIMSignMessage = async (message: string, coinTypeIndex: number, index: number) => {
    return signMessage({
      messageHash: message,
      coinType: coinTypeIndex,
      coinTypeIndex: index,
    });
  };

  public updateBPIN = async () => {
    return updateBPIN();
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
    const pubkeyList = await this.getBSIMPublicKeys();
    const currentPubkey = pubkeyList.find((item) => item?.address === fromAddress);

    if (!currentPubkey) {
      throw new Error("Can't get current pubkey from BSIM card");
    }

    const cancelSignal = new Subject<void>();
    let cancel!: () => void;
    const cancelPromise = new Promise(
      (_, reject) =>
        (cancel = () => {
          cancelSignal.next();
          cancelSignal.complete();
          reject(new BSIMError('cancel', BSIM_ERRORS.cancel));
        }),
    );

    const polling = firstValueFrom(
      defer(() => from(this.BSIMSignMessage(hash, currentPubkey.coinType, currentPubkey.index))).pipe(
        catchError((err: { code: string; message: string }) => {
          errorMsg = err.message;
          errorCode = err.code;
          return throwError(() => err);
        }),
        retry({ delay: 1000 }),
        timeout({ each: 30 * 1000, with: () => throwError(() => new BSIMErrorEndTimeout(errorCode, errorMsg)) }),
        takeUntil(cancelSignal),
      ),
    );
    const resPromise = Promise.race([polling, cancelPromise] as const)
      .then(
        (res) =>
          res as {
            code: string;
            message: string;
            r: string;
            s: string;
            v: string;
          },
      )
      .catch((err) => {
        if (String(err).includes('no elements in sequence')) {
          throw new BSIMError('cancel', BSIM_ERRORS.cancel);
        } else {
          throw err;
        }
      });
    return [resPromise, cancel] as const;
  };

  public signTransaction = async (fromAddress: string, tx: ITxEvm) => {
    const transaction = new Transaction();
    for (const key in tx) {
      transaction[key as 'to'] = tx[key as 'to'];
    }

    const hash = transaction.unsignedHash;
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);

    return [
      resPromise.then((res) => {
        transaction.signature = Signature.from({ r: res.r, s: res.s, v: res.v });
        // get the transaction encoded
        return transaction.serialized;
      }),
      cancel,
    ] as const;
  };

  public signMessage = async (message: string, fromAddress: string) => {
    const hash = hashMessage(message);
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);
    return [resPromise.then((res) => Signature.from({ r: res.r, s: res.s, v: res.v })), cancel] as const;
  };

  public signTypedData = async (domain: TypedDataDomain, _types: Record<string, Array<TypedDataField>>, value: Record<string, any>, fromAddress: string) => {
    // https://github.com/ethers-io/ethers.js/discussions/3163
    const { EIP712Domain, ...types } = _types;
    const hash = TypedDataEncoder.hash(domain, types, value);
    const [resPromise, cancel] = await this.BSIMSign(hash, fromAddress);
    return [resPromise.then((res) => Signature.from({ r: res.r, s: res.s, v: res.v })), cancel] as const;
  };
}

export default new BSIMPluginClass();
