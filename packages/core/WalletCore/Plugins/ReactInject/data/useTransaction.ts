import { AssetType } from '@core/database/models/Asset';
import { atom } from 'jotai';

export interface WalletTransactionType {
  from: string;
  to: string;
  assetType: AssetType;
  balance: string;
  decimals: number;
  symbol: string;
  contractAddress?: string;
  iconUrl?: string;
  amount: number;
  priceInUSDT?: string;
  tokenId?: string; // 721
  tokenImage?: string; // 721
  contractName?: string; // 721
  nftName?: string; // 721
}

const initTransaction: WalletTransactionType = {
  from: '',
  to: '',
  assetType: AssetType.Native,
  balance: '0',
  decimals: 18,
  symbol: 'CFX',
  amount: 0,
};

export const transactionAtom = atom<WalletTransactionType>(initTransaction);

export const setTransactionTo = atom(null, (get, set, to: string) => {
  set(transactionAtom, { ...get(transactionAtom), to, amount: 0 });
});

export const setTransactionAmount = atom(null, (get, set, amount: number) => {
  set(transactionAtom, { ...get(transactionAtom), amount });
});

export const setTokenTransaction = atom(
  null,
  (get, set, token: Pick<WalletTransactionType, 'assetType' | 'balance' | 'symbol' | 'decimals' | 'contractAddress' | 'priceInUSDT' | 'iconUrl'>) => {
    set(transactionAtom, { ...get(transactionAtom), ...token });
  }
);

export const setNFTTransaction = atom(null, (get, set, token: Omit<WalletTransactionType, 'from' | 'to' | 'amount'>) => {
  set(transactionAtom, { ...get(transactionAtom), ...token });
});
