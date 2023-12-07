import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, View } from 'react-native';
import { ERC721And1155TokenListAtom, NFTItemDetail } from '@hooks/useTokenList';
import { useAtom } from 'jotai';
import NFTItem, { NFTItemPressArgs } from './NFTItem';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useCallback, useEffect, useRef, useState } from 'react';
import Skeleton from '@components/Skeleton';
import { firstValueFrom } from 'rxjs';
import { scanOpenAPISend } from '@core/utils/send';

const NFTList: React.FC<{ onPress?: (v: NFTItemPressArgs) => void; pageSize?: number }> = ({ onPress, pageSize = 24 }) => {
  const [tokenList, setTokenList] = useAtom(ERC721And1155TokenListAtom);
  const address = useCurrentAddress()!;
  const currentNetwork = useCurrentNetwork()!;

  const [currentOpen, setCurrentOpen] = useState<string | null>(null);
  const inRequest = useRef(false);

  const handleSelectNFT = (nft: NFTItemPressArgs) => {
    if (onPress) {
      onPress(nft);
    }
  };
  const handleOnscroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const needMore = event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height - event.nativeEvent.contentOffset.y < 500;
    if (needMore) {
      requestNFT();
    }
  };

  const requestNFT = useCallback(async () => {
    if (inRequest.current) return;
    if (currentOpen === null) return;
    const openList = tokenList?.find((v) => v.contract === currentOpen);
    if (!openList) return;
    const { page, total } = openList;

    if (openList.total <= openList.NFTList.length && openList.page !== 0) return;

    let skip = 0;
    if (total > page * pageSize) {
      skip = page * pageSize;
    }

    inRequest.current = true;

    firstValueFrom(
      scanOpenAPISend<{ message: string; result: { list: NFTItemDetail[]; next: number; total: number }; status: string }>(
        currentNetwork?.chainId,
        `/nft/tokens?contract=${currentOpen}&owner=${address.hex}&sort=ASC&sortField=latest_update_time&cursor=0&skip=${skip}&limit=${pageSize}&withBrief=true&withMetadata=false&suppressMetadataError=true`
      )
    )
      .then((res) => {
        const result = { ...openList };
        if (page === 0) {
          result.NFTList = res.result.list;
        } else {
          const hash = result.NFTList.reduce((acc, cur) => {
            acc[cur.tokenId] = true;
            return acc;
          }, {} as Record<string, boolean>);
          result.NFTList = [...result.NFTList, ...res.result.list.filter((v) => !hash[v.tokenId])];
        }

        result.page = result.page + 1;

        result.total = res.result.total;

        setTokenList((v) => (v === null ? v : v.map((v) => (v.contract === currentOpen ? result : v))));
      })
      .finally(() => {
        inRequest.current = false;
      });
  }, [address?.hex, currentNetwork?.chainId, currentOpen, setTokenList, tokenList, pageSize]);

  useEffect(() => {
    if (currentOpen === null) return;
    const openList = tokenList?.find((v) => v.contract === currentOpen);
    if (!openList) return;
    if (openList.NFTList.length === 0) {
      requestNFT();
    }
  }, [requestNFT, currentOpen, tokenList]);

  return (
    <ScrollView onScroll={handleOnscroll}>
      {tokenList ? (
        tokenList.map((item) => (
          <NFTItem
            currentOpen={currentOpen}
            setCurrentOpen={setCurrentOpen}
            key={item.contract}
            nftInfo={item}
            ownerAddress={address?.hex}
            onPress={handleSelectNFT}
          />
        ))
      ) : (
        <View className="flex-1 ">
          <View className="flex flex-row items-center p-6">
            <Skeleton circle width={32} height={32} style={{ marginRight: 8 }} />
            <Skeleton width={70} height={16} />
          </View>
          <View className="flex flex-row items-center p-6">
            <Skeleton circle width={32} height={32} style={{ marginRight: 8 }} />
            <Skeleton width={70} height={16} />
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default NFTList;
