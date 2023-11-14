import { switchMap, of, catchError, firstValueFrom } from 'rxjs';
import { atom, useAtom } from 'jotai';
import { map } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { formatUnits } from 'ethers';
let host = 'https://evmapi.confluxscan.io';

if (__DEV__) {
  host = 'https://evmapi-testnet.confluxscan.io';
}

export interface TokenListItem {
  name: string;
  decimals: number;
  symbol: string;
  type: string;
  amount: string;
  contract: string;
  priceInUSDT?: string;
  iconUrl?: string;
}

interface TokenListResponse {
  status: string;
  message: string;
  result: {
    list: TokenListItem[];
  };
}

export enum FetchTokenListType {
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
  ALL = 'ERC20,ERC721,ERC1155',
}

export const requestTokenList = (hexAddress: string, tokenType = FetchTokenListType.ERC20) =>
  fromFetch<TokenListResponse>(`${host}/account/tokens?account=${hexAddress}&tokenType=${tokenType}`, {
    selector: (response) => {
      if (response.ok) {
        return response.json();
      } else {
        return of({ status: '0', message: '', result: { list: [] } });
      }
    },
  }).pipe(
    map((res) => res.result.list),
    map((list) =>
      list.sort((a, b) => {
        if (a.priceInUSDT && b.priceInUSDT) {
          return Number(formatUnits(a.amount, a.decimals)) * Number(a.priceInUSDT) < Number(formatUnits(b.amount, b.decimals)) * Number(b.priceInUSDT) ? 1 : -1;
        } else if (a.priceInUSDT) {
          return -1;
        } else if (b.priceInUSDT) {
          return 1;
        }
        return a.symbol < b.symbol ? 1 : -1;
      })
    )
  );

export const ERC20tokenListAtom = atom<TokenListItem[]>([]);
