import { AssetType } from '@core/database/models/Asset';
import { atom, useAtomValue } from 'jotai';
import { Subject } from 'rxjs';

export enum TxEventTypesName {
  ERROR = 'error',
  GET_NONCE = 'getNonce',

  BSIM_VERIFY_START = 'BSIMVerifyStart',
  BSIM_SIGN_START = 'BSIMSignStart',
  BSIM_TX_SEND = 'BSIMTxSend',
}

interface TxEvent {
  type: TxEventTypesName;
  message?: string;
  error?: boolean;
  nonce?: string;
}

export interface WalletTransactionType {
  event: Subject<TxEvent>;
  from: string;
  to: string;
  assetType: AssetType;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string;
  iconUrl?: string;
  amount: bigint;
  priceInUSDT?: string;
  tokenId?: string; // 721
  tokenImage?: string; // 721
  contractName?: string; // 721
  nftName?: string; // 721
}

const initTransaction: WalletTransactionType = {
  event: new Subject(),
  from: '',
  to: '',
  assetType: AssetType.Native,
  balance: '0',
  decimals: 18,
  symbol: 'CFX',
  amount: 0n,
};
const transactionAtom = atom<WalletTransactionType>(initTransaction);

export const useReadOnlyTransaction = () => useAtomValue(transactionAtom);

export const setTransactionTo = atom(null, (get, set, to: string) => {
  set(transactionAtom, { ...get(transactionAtom), to, amount: 0n });
});
export const resetTransactionTo = atom(null, (get, set) => {
  set(transactionAtom, { ...get(transactionAtom), to: '', amount: 0n });
});

export const setTransactionAmount = atom(null, (get, set, amount: bigint) => {
  set(transactionAtom, { ...get(transactionAtom), amount });
});

export const resetTransactionAmount = atom(null, (get, set) => {
  set(transactionAtom, { ...get(transactionAtom), amount: 0n });
});

export const setTokenTransaction = atom(
  null,
  (get, set, token: Pick<WalletTransactionType, 'assetType' | 'balance' | 'symbol' | 'decimals' | 'contractAddress' | 'priceInUSDT' | 'iconUrl'>) => {
    set(transactionAtom, { ...get(transactionAtom), ...token });
  }
);

export const setNFTTransaction = atom(null, (get, set, token: Omit<WalletTransactionType, 'event' | 'from' | 'to' | 'amount'>) => {
  set(transactionAtom, { ...get(transactionAtom), ...token });
});

export const resetTransaction = atom(null, (get, set) => {
  set(transactionAtom, initTransaction);
});
