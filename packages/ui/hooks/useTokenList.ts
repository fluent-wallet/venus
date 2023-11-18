import { of } from 'rxjs';
import { atom } from 'jotai';
import { map, switchMap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { formatUnits } from 'ethers';
import { TokenType } from './useTransaction';
import { querySelectedNetwork } from '@core/DB/models/Network/service';
import database from '@core/DB';
import { scanOpenAPISend } from '@core/utils/send';

export interface AccountTokenListItem {
  name: string;
  decimals: number;
  symbol: string;
  type: TokenType;
  amount: string;
  contract: string;
  priceInUSDT?: string;
  iconUrl?: string;
}

interface TokenListResponse {
  status: string;
  message: string;
  result: {
    list: AccountTokenListItem[];
  };
}

export const requestTokenList = (hexAddress: string, tokenType: TokenType | string = TokenType.ERC20) =>
  scanOpenAPISend<TokenListResponse>(`/account/tokens?account=${hexAddress}&tokenType=${tokenType}`).pipe(
    map((res) => (res.status === '1' ? res.result.list : [])),
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

export const ERC20tokenListAtom = atom<AccountTokenListItem[]>([]);

export const ERC721And1155TokenListAtom = atom<AccountTokenListItem[]>([]);
