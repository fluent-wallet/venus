import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { firstValueFrom, map, switchMap, of } from 'rxjs';
import { useAtom } from 'jotai';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';
import { scanAPISend } from '@core/utils/send';
import { decode } from '@core/utils/address';
import { addHexPrefix } from '@core/utils/base';
import { AccountTokenListItem, ERC721And1155TokenListAtom, requestTokenList } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import { NFTItemDetail, NFTItem } from './NFTItem';

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

const NFTList: React.FC<{ onPress?: (v: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void }> = ({ onPress }) => {
  const currentAddress = useCurrentAddress();
  const [tokenList, setTokenList] = useAtom(ERC721And1155TokenListAtom);

  useEffect(() => {
    if (!currentAddress) return;
    firstValueFrom(
      requestTokenList(currentAddress.hex, [TokenType.ERC721, TokenType.ERC1155].join(',')).pipe(
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
  }, [setTokenList, currentAddress]);

  const handleSelectNFT = (token: NFTItemDetail & AccountTokenListItem & { contractName: string; nftName: string }) => {
    if (onPress) {
      onPress(token);
    }
  };

  return (
    <ScrollView>
      {tokenList.map((item) => (
        <NFTItem key={item.contract} nftInfo={item} ownerAddress={currentAddress?.hex ?? ''} onPress={handleSelectNFT} />
      ))}
    </ScrollView>
  );
};

export default NFTList;
