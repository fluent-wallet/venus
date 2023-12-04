import { atom } from 'jotai';
import { map, switchMap, firstValueFrom, filter, repeat, combineLatest, throwError, catchError, of, Subject, timer } from 'rxjs';
import { formatUnits } from 'ethers';
import { TokenType } from './useTransaction';
import { RPCResponse, RPCSend, scanAPISend, scanOpenAPISend } from '@core/utils/send';
import { decode } from '@core/utils/address';
import { addHexPrefix } from '@core/utils/base';
import Events from '@core/WalletCore/Events';
import { CFX_ESPACE_TESTNET_CHAINID } from '@core/utils/consts';
import { CFX_ESPACE_TESTNET_WALLET_CONTRACT_ADDRESS } from '@core/consts/network';
import { WalletInterface } from '@core/contracts/ABI/Wallet';

interface _ResponseAccountTokenListItem {
  name: string;
  decimals: number;
  symbol: string;
  type: TokenType;
  amount: string;
  contract: string;
  priceInUSDT?: string;
  iconUrl?: string;
}

// rename amount to balance
export type AccountTokenListItem = Omit<_ResponseAccountTokenListItem, 'amount'> & { balance: string };

interface TokenListResponse {
  status: string;
  message: string;
  result: {
    list: _ResponseAccountTokenListItem[];
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
    switchMap((res) => {
      if (res.status === '1') return of(res.result.list);
      return throwError(() => new Error(res.message));
    }),
    map((list) =>
      list.map((item) => {
        const { amount, ...res } = item;
        const result: AccountTokenListItem = { ...res, balance: amount };
        return result;
      })
    ),
    map((list) =>
      list.sort((a, b) => {
        if (a.type === TokenType.NATIVE) return -1;
        if (b.type === TokenType.NATIVE) return 1;

        if (a.priceInUSDT && b.priceInUSDT) {
          return Number(formatUnits(a.balance, a.decimals)) * Number(a.priceInUSDT) < Number(formatUnits(b.balance, b.decimals)) * Number(b.priceInUSDT)
            ? 1
            : -1;
        } else if (a.priceInUSDT) {
          return -1;
        } else if (b.priceInUSDT) {
          return 1;
        }
        return a.symbol < b.symbol ? 1 : -1;
      })
    )
  );

export const loopNative721And1155List = combineLatest([
  Events.currentAddressObservable.pipe(filter((v) => v !== null)),
  Events.currentNetworkObservable.pipe(filter((v) => v !== null && !!v.chainId)),
]).pipe(
  switchMap(([address, network]) =>
    requestTokenList(network!.chainId, address!.hex, [TokenType.NATIVE, TokenType.ERC721, TokenType.ERC1155].join(',')).pipe(repeat({ delay: 5 * 1000 }))
  )
);

export const getTokenInfoByTokenContractAddresses = (endpoint: string, ownerAddress: string, chainId: string, contracts: string[]) => {
  if (chainId !== CFX_ESPACE_TESTNET_CHAINID) return throwError(() => new Error('wallet contract only espace test network'));
  const to = CFX_ESPACE_TESTNET_WALLET_CONTRACT_ADDRESS;
  const tokens = contracts;
  const data = WalletInterface.encodeFunctionData('assetsOf', [ownerAddress, tokens]);

  return RPCSend<RPCResponse<string>>(endpoint, { method: 'eth_call', params: [{ to, data }] }).pipe(
    map((res) => WalletInterface.decodeFunctionResult('assetsOf', res.result))
  );
};

export const scanERC20ListSubject = new Subject<{ delay: number }>();

export const loopERC20ListTask = scanERC20ListSubject.pipe(
  switchMap((n) => timer(n.delay).pipe(map(() => n))),
  switchMap(() =>
    combineLatest([
      Events.currentAddressObservable.pipe(filter((v) => v !== null)),
      Events.currentNetworkObservable.pipe(filter((v) => v !== null && !!v.chainId)),
    ])
  ),
  switchMap(([address, network]) =>
    requestTokenList(network!.chainId, address!.hex, TokenType.ERC20).pipe(
      switchMap((scanRes) => {
        const { chainId, endpoint } = network!;
        const { hex } = address!;
        // TODO add mainnet wallet contract address
        const tokens = scanRes.map((item) => item.contract);
        return getTokenInfoByTokenContractAddresses(endpoint, hex, chainId, tokens).pipe(
          map((contractRes) => {
            // get token  name  symbol  decimals from contract , other properties from scan api
            const hash: Record<string, AccountTokenListItem> = {};
            contractRes.forEach((item) => {
              item.forEach((tokenInfo: [[string, string, string, bigint], bigint]) => {
                const [other, balance] = tokenInfo;
                const [token, name, symbol, decimals] = other;
                hash[token.toLowerCase()] = { name, symbol, decimals: Number(decimals), balance: balance.toString(), contract: token, type: TokenType.ERC20 };
              });
            });
            // loop scan api result get token price and icon
            scanRes.forEach((item) => {
              if (hash[item.contract.toLowerCase()]) {
                hash[item.contract].iconUrl = item.iconUrl;
                hash[item.contract].priceInUSDT = item.priceInUSDT;
              }
            });
            return Object.values(hash);
          })
        );
      }),
      catchError((err) => {
        console.log('catch error so return null');
        return of(null);
      })
    )
  )
);

// native token
export const nativeTokenAtom = atom<AccountTokenListItem | null>(null);

// ERC721 and ERC1155 token list
export const ERC721And1155TokenListAtom = atom<AccountTokenListItem[] | null>(null);

export const writeNativeAndNFTTokenListAtom = atom(null, async (get, set, tokenList: AccountTokenListItem[]) => {
  const nativeToken = tokenList.find((item) => item.type === TokenType.NATIVE);

  const erc721And1155TokenList = tokenList.filter((item) => [TokenType.ERC721, TokenType.ERC1155].includes(item.type));

  if (nativeToken) set(nativeTokenAtom, nativeToken);

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

// default page size is 8
const DEFAULT_FAIL_BACK_PAGE_SIZE = 8;

export const getERC20ByWalletContract = (page: number, pageSize = DEFAULT_FAIL_BACK_PAGE_SIZE, tokenType: 20 | 721 | 1155 = 20) =>
  firstValueFrom(
    combineLatest([
      Events.currentAddressObservable.pipe(filter((v) => v !== null)),
      Events.currentNetworkObservable.pipe(filter((v) => v !== null && !!v.chainId && !!v.endpoint)),
    ]).pipe(
      switchMap(([address, network]) => {
        // TODO add mainnet wallet contract address
        if (network?.chainId !== CFX_ESPACE_TESTNET_CHAINID) return throwError(() => new Error('wallet contract only espace test network'));
        const data = WalletInterface.encodeFunctionData('assets', [address?.hex, tokenType, page, pageSize]);
        return RPCSend<RPCResponse<string>>(network!.endpoint, { method: 'eth_call', params: [{ to: CFX_ESPACE_TESTNET_WALLET_CONTRACT_ADDRESS, data }] }).pipe(
          map((res) => WalletInterface.decodeFunctionResult('assets', res.result)),
          map((contractRes) => {
            const [total, assetInfos] = contractRes;
            return {
              total: Number(total),
              list: (assetInfos as [[string, string, string, bigint], bigint][]).map((item) => {
                const [info, balance] = item;
                const [contract, name, symbol, decimals] = info;

                return {
                  type: TokenType.ERC20,
                  contract: contract,
                  name,
                  symbol,
                  decimals: Number(decimals),
                  balance: balance.toString(),
                } as AccountTokenListItem;
              }),
            };
          })
        );
      })
    )
  );

// ERC20 token list
export const ERC20tokenListAtom = atom<AccountTokenListItem[] | null>(null);
export const tokenListStateAtom = atom<{ type: 'scan' | 'failBack' }>({ type: 'scan' });

type ERC20TokenListFailBackListType = { page: number; pageSize: number; total: number; list: AccountTokenListItem[] };
const ERC20TokenListFailBackListAtom = atom<ERC20TokenListFailBackListType>({
  page: 1,
  pageSize: DEFAULT_FAIL_BACK_PAGE_SIZE,
  total: 0,
  list: [],
});
export const readScanAndFailBackTokenListAtom = atom((get) => {
  const state = get(tokenListStateAtom);

  if (state.type === 'scan') {
    const scanList = get(ERC20tokenListAtom);
    return scanList;
  } else {
    const failBackList = get(ERC20TokenListFailBackListAtom);
    return failBackList.list;
  }
});

// for out side read the list
let failBackList: AccountTokenListItem[] = [];

export const readAndWriteERC20TokenListFailBackListAtom = atom(
  (get) => get(ERC20TokenListFailBackListAtom),
  (get, set, fn: (args: ERC20TokenListFailBackListType) => ERC20TokenListFailBackListType) => {
    const oldValue = get(ERC20TokenListFailBackListAtom);
    const newValue = fn(oldValue);

    failBackList = newValue.list || [];
    set(ERC20TokenListFailBackListAtom, newValue);
  }
);

export const failBackListSubject = new Subject<{ delay: number }>();

export const loopFailBackListTask = failBackListSubject.pipe(
  switchMap((n) => timer(n.delay).pipe(map(() => n))),
  switchMap(() =>
    combineLatest([
      Events.currentAddressObservable.pipe(filter((v) => v !== null)),
      Events.currentNetworkObservable.pipe(filter((v) => v !== null && !!v.chainId)),
    ])
  ),
  switchMap(([address, network]) => {
    const { hex } = address!;
    const { chainId, endpoint } = network!;
    // read list form the outside list
    const tokens = failBackList.map((item) => item.contract);
    if (tokens.length === 0) return of([]);
    return getTokenInfoByTokenContractAddresses(endpoint, hex, chainId, tokens).pipe(
      map((contractRes) => {
        // get token  name  symbol  decimals from contract , other properties from scan api
        const result: AccountTokenListItem[] = [];
        contractRes.forEach((item) => {
          item.forEach((tokenInfo: [[string, string, string, bigint], bigint]) => {
            const [other, balance] = tokenInfo;
            const [token, name, symbol, decimals] = other;
            result.push({ name, symbol, decimals: Number(decimals), balance: balance.toString(), contract: token, type: TokenType.ERC20 });
          });
        });
        return result;
      })
    );
  })
);
