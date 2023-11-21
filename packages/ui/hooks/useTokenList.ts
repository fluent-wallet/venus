import { atom } from 'jotai';
import { map, switchMap, firstValueFrom } from 'rxjs';
import { formatUnits } from 'ethers';
import { TokenType } from './useTransaction';
import { RPCSend, scanAPISend, scanOpenAPISend } from '@core/utils/send';
import { decode } from '@core/utils/address';
import { addHexPrefix } from '@core/utils/base';

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

interface TokenDetail {
  address: string;
  contractName: string;
  decimals: null | number;
  ensInfo: { name: string };
  granularity: null | number;
  holderCount: number;
  iconUrl: string;
  name: string;
  price: null | string;
  quoteUrl: null | string;
  symbol: string;
  totalPrice: null | string;
  totalSupply: string;
  transferCount: number;
  transferType: string;
}

export const requestTokenList = (chainId: string, hexAddress: string, tokenType: TokenType | string = TokenType.ERC20) =>
  scanOpenAPISend<TokenListResponse>(chainId, `/account/tokens?account=${hexAddress}&tokenType=${tokenType}`).pipe(
    map((res) => (res.status === '1' ? res.result.list : [])),
    map((list) =>
      list.sort((a, b) => {
        if (a.type === TokenType.NATIVE) return -1;
        if (b.type === TokenType.NATIVE) return 1;

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

export const nativeAndERC20tokenListAtom = atom<AccountTokenListItem[] | null>(null);

export const ERC721And1155TokenListAtom = atom<AccountTokenListItem[] | null>(null);

export const writeTokenListAtom = atom(null, async (get, set, tokelist: AccountTokenListItem[]) => {
  const nativeToken = tokelist.find((item) => item.type === TokenType.NATIVE);
  const erc20TokenList = tokelist.filter((item) => item.type === TokenType.ERC20);
  const erc721And1155TokenList = tokelist.filter((item) => [TokenType.ERC721, TokenType.ERC1155].includes(item.type));

  set(nativeAndERC20tokenListAtom, nativeToken ? [nativeToken, ...erc20TokenList] : erc20TokenList);

  if (erc721And1155TokenList.length > 0) {
    const newERC721And1155TokenList = await firstValueFrom(
      scanAPISend<{ code: number; message: string; total: number; result: { list: TokenDetail[] } }>(
        `v1/token?${erc721And1155TokenList.reduce((acc, cur) => (acc ? `${acc}&addressArray=${cur.contract}` : `addressArray=${cur.contract}`), '')}`
      ).pipe(
        map((res) => {
          // request NFT contract icon
          const hash = erc721And1155TokenList.reduce((acc, cur) => {
            acc[cur.contract] = cur;
            return acc;
          }, {} as Record<string, AccountTokenListItem>);
          res.result.list.forEach((item) => {
            const hex = decode(item.address);
            const address = addHexPrefix(hex.hexAddress.toString('hex'));
            if (hash[address]) {
              hash[address].iconUrl = item.iconUrl;
            }
          });
          return erc721And1155TokenList;
        })
      )
    );
    set(ERC721And1155TokenListAtom, newERC721And1155TokenList);
  } else {
    set(ERC721And1155TokenListAtom, erc721And1155TokenList);
  }
});
