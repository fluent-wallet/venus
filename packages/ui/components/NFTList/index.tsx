import { useEffect } from 'react';
import { FlatList, ScrollView } from 'react-native';
import { firstValueFrom, map, switchMap, of } from 'rxjs';
import { Address } from '@core/DB/models/Address';
import { querySelectedAddress } from '@core/DB/models/Address/service';
import { AccountTokenListItem, ERC721And1155TokenListAtom, requestTokenList } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import { Database } from '@nozbe/watermelondb';
import { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { useAtom } from 'jotai';
import { NFTItemDetail, NFTItem } from './NFTItem';
import { scanAPISend } from '@core/utils/send';
import { decode } from '@core/utils/address';
import { addHexPrefix } from '@core/utils/base';

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

const NFTList: React.FC<{ address: Address; onPress?: (v: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void }> = ({
  address,
  onPress,
}) => {
  const [tokenList, setTokenList] = useAtom(ERC721And1155TokenListAtom);

  useEffect(() => {
    firstValueFrom(
      requestTokenList(address.hex, [TokenType.ERC721, TokenType.ERC1155].join(',')).pipe(
        switchMap((tokenList) => {
          if (tokenList.length > 0) {
            return scanAPISend<{ code: number; message: string; total: number; result: { list: TokenDetail[] } }>(
              `v1/token?${tokenList.reduce((acc, cur) => (acc ? `${acc}&addressArray=${cur.contract}` : `addressArray=${cur.contract}`), '')}`
            ).pipe(
              map((res) => {
                // request NFT contract icon
                const hash = tokenList.reduce((acc, cur) => {
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

                return tokenList;
              })
            );
          } else {
            return of([]);
          }
        })
      )
    ).then((list) => {
      setTokenList(list);
    });
  }, [setTokenList, address]);

  const handleSelectNFT = (token: NFTItemDetail & AccountTokenListItem & { contractName: string; nftName: string }) => {
    if (onPress) {
      onPress(token);
    }
  };

  return (
    <ScrollView>
      {tokenList.map((item) => (
        <NFTItem key={item.contract} nftInfo={item} ownerAddress={address.hex} onPress={handleSelectNFT} />
      ))}
    </ScrollView>
  );
};

export default withDatabase(
  withObservables([], ({ database }: { database: Database }) => {
    const address = querySelectedAddress(database).observe();
    return {
      address: address.pipe(map((address) => address[0])),
    };
  })(NFTList)
);
