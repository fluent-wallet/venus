import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, View, Pressable } from 'react-native';
import ActivityItem from './ActivityItem';
import { useCurrentAddress, useUnfinishedTxs, useFinishedTxs } from '@core/WalletCore/Plugins/ReactInject';
import { useCallback, useEffect, useRef, useState } from 'react';
import Skeleton from '@components/Skeleton';
import { Tx } from '@core/database/models/Tx';
import { useTheme, Card, Text } from '@rneui/themed';

const ActivityList: React.FC<{ onPress?: (v: Tx) => void; pageSize?: number }> = ({ onPress, pageSize = 24 }) => {
  const { theme } = useTheme();
  const finishedTxs = useFinishedTxs();
  const unfinishedTxs = useUnfinishedTxs();

  const empty = !finishedTxs?.length && !unfinishedTxs?.length;

  const handleSelect = (tx: Tx) => {
    if (onPress) {
      onPress(tx);
    }
  };
  const handleOnscroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const needMore = event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height - event.nativeEvent.contentOffset.y < 500;
    if (needMore) {
      // requestNFT();
    }
  };

  // const requestNFT = useCallback(async () => {
  //   if (inRequest.current) return;
  //   if (currentOpen === null) return;
  //   const openList = tokenList?.find((v) => v.contract === currentOpen);
  //   if (!openList) return;
  //   const { page, total } = openList;

  //   if (openList.total <= openList.NFTList.length && openList.page !== 0) return;

  //   let skip = 0;
  //   if (total > page * pageSize) {
  //     skip = page * pageSize;
  //   }

  //   inRequest.current = true;

  //   firstValueFrom(
  //     scanOpenAPISend<{ message: string; result: { list: NFTItemDetail[]; next: number; total: number }; status: string }>(
  //       currentNetwork?.chainId,
  //       `/nft/tokens?contract=${currentOpen}&owner=${address.hex}&sort=ASC&sortField=latest_update_time&cursor=0&skip=${skip}&limit=${pageSize}&withBrief=true&withMetadata=false&suppressMetadataError=true`
  //     )
  //   )
  //     .then((res) => {
  //       const result = { ...openList };
  //       if (page === 0) {
  //         result.NFTList = res.result.list;
  //       } else {
  //         const hash = result.NFTList.reduce((acc, cur) => {
  //           acc[cur.tokenId] = true;
  //           return acc;
  //         }, {} as Record<string, boolean>);
  //         result.NFTList = [...result.NFTList, ...res.result.list.filter((v) => !hash[v.tokenId])];
  //       }

  //       result.page = result.page + 1;

  //       result.total = res.result.total;

  //       setTokenList((v) => (v === null ? v : v.map((v) => (v.contract === currentOpen ? result : v))));
  //     })
  //     .finally(() => {
  //       inRequest.current = false;
  //     });
  // }, [address?.hex, currentNetwork?.chainId, currentOpen, setTokenList, tokenList, pageSize]);

  // useEffect(() => {
  //   if (currentOpen === null) return;
  //   const openList = tokenList?.find((v) => v.contract === currentOpen);
  //   if (!openList) return;
  //   if (openList.NFTList.length === 0) {
  //     requestNFT();
  //   }
  // }, [requestNFT, currentOpen, tokenList]);

  return (
    <ScrollView onScroll={handleOnscroll}>
      {!empty ? (
        <View className="pt-[15px] pb-[25px] px-[25px]">
          {!!unfinishedTxs?.length && (
            <View className="pb-[15px]">
              <Card>
                <View className="flex flex-col items-start gap-y-[25px]">
                  {unfinishedTxs.map((item) => (
                    <ActivityItem key={item.id} tx={item} onPress={handleSelect} />
                  ))}
                </View>
              </Card>
            </View>
          )}
          {!!finishedTxs?.length && (
            <Card>
              <View className="flex flex-col items-start gap-y-[25px]">
                {finishedTxs.map((item) => (
                  <ActivityItem key={item.id} tx={item} onPress={handleSelect} />
                ))}
              </View>
            </Card>
          )}
        </View>
      ) : (
        <View className="flex-1 px-[25px]">
          <View className="flex flex-row items-center p-6">
            <Skeleton className="w-full" height={16} />
          </View>
          <View className="flex flex-row items-center p-6">
            <Skeleton className="w-full" height={16} />
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default ActivityList;
