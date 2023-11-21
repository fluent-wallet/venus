import { atom } from 'jotai';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

export enum TokenType {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  NATIVE = 'native',
}

export const transactionAtom = atom<{
  from: string;
  to: string;
  tokenType: TokenType;
  balance: string;
  decimals: number;
  symbol: string;
  contract?: string;
  iconUrl?: string;
  amount: number;
  priceInUSDT?: string;
  tokenId?: string; // 721
  tokenImage?: string; // 721
  contractName?: string; // 721
  nftName?: string; // 721
}>({
  from: '',
  to: '',
  tokenType: TokenType.NATIVE,
  balance: '0',
  decimals: 18,
  symbol: 'CFX',
  amount: 0,
});

export const setTransactionTo = atom(null, (get, set, to: string) => {
  set(transactionAtom, { ...get(transactionAtom), to });
});

export const setTransactionAmount = atom(null, (get, set, amount: number) => {
  set(transactionAtom, { ...get(transactionAtom), amount });
});
