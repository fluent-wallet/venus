import { FlatList, ActivityIndicator, ViewToken } from 'react-native';
import { useAtom } from 'jotai';
import {
  ERC20tokenListAtom,
  AccountTokenListItem,
  nativeTokenAtom,
  writeNativeAndNFTTokenListAtom,
  loopERC20ListTask,
  loopNative721And1155List,
  getERC20ByWalletContract,
  readAndWriteERC20TokenListFallbackListAtom,
  tokenListStateAtom,
  scanERC20ListSubject,
  loopFallbackListTask,
  fallBackListSubject,
} from '@hooks/useTokenList';

import TokenItem from './TokenItem';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';
import SkeletonList from './SkeletonList';
import { useNetInfo } from '@react-native-community/netinfo';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void; skeleton?: number }> = ({ onPress, skeleton = 4 }) => {
  const [tokenListState, setTokenListState] = useAtom(tokenListStateAtom);
  const { __, isConnected } = useNetInfo();

  const [fallBackList, setFallBakList] = useAtom(readAndWriteERC20TokenListFallbackListAtom);
  const loadingMore = useRef(false);

  const [nativeToken] = useAtom(nativeTokenAtom);

  const [ERC20TokenList, setERC20TokenList] = useAtom(ERC20tokenListAtom);

  const [_, writeNFTTokenList] = useAtom(writeNativeAndNFTTokenListAtom);

  const getFallBackList = useCallback(
    (page = 1) => {
      loadingMore.current = true;
      getERC20ByWalletContract(page)
        .then((res) => {
          const { total, list } = res;
          setFallBakList((v) => ({ ...v, total, page: v.page + 1, list: [...v.list, ...list] }));
        })
        .finally(() => {
          loadingMore.current = false;
        });
    },
    [setFallBakList]
  );

  const handleLoadMore = () => {
    const { page, pageSize, total } = fallBackList;
    const skip = (page - 1) * pageSize;
    if (skip >= total || loadingMore.current || tokenListState.type === 'scan') return;
    getFallBackList(page);
  };

  useFocusEffect(
    useCallback(() => {
      // loop and check scan api
      const subscribe = loopERC20ListTask.subscribe({
        next: (res) => {
          if (res === null) {
            setTokenListState({ type: 'fallback' }); // set type to fallback
            // then start loop check every 30 seconds
            scanERC20ListSubject.next({ delay: 30 * 1000 });
          } else {
            setTokenListState({ type: 'scan' });
            setERC20TokenList(res);
            // if ok loop  every 5 seconds
            scanERC20ListSubject.next({ delay: 5 * 1000 });
          }
        },
        error: (err) => {
          console.log(err);
        },
      });
      // first request is immediately
      scanERC20ListSubject.next({ delay: 0 });
      return () => {
        subscribe.unsubscribe();
      };
    }, [setERC20TokenList, setTokenListState])
  );

  useFocusEffect(
    useCallback(() => {
      // loop scan api get NFT token list
      const subscribe = loopNative721And1155List.subscribe({
        next: (res) => {
          writeNFTTokenList(res);
        },
        error: (error) => {
          console.log(error);
        },
      });
      return () => {
        subscribe.unsubscribe();
      };
    }, [writeNFTTokenList])
  );

  useFocusEffect(
    useCallback(() => {
      // if state is fallback ,then call contract api to get token list
      if (tokenListState.type === 'fallback') {
        getERC20ByWalletContract(1).then((res) => {
          const { total, list } = res;
          setFallBakList((v) => ({ ...v, total, page: v.page + 1, list: [...list] }));
        });
      }
    }, [tokenListState.type, setFallBakList])
  );

  useFocusEffect(
    useCallback(() => {
      // if state is fallback ,then loop to call contract api to get token list
      if (tokenListState.type !== 'fallback') return;
      const subscribe = loopFallbackListTask.subscribe({
        next: (newList) => {
          setFallBakList((v) => ({ ...v, list: newList }));
          //if state is fallback loop list  every 5 seconds
          fallBackListSubject.next({ delay: 5 * 1000 });
        },
        error: (err) => {
          console.log(err);
        },
      });

      fallBackListSubject.next({ delay: 0 });
      return () => {
        subscribe.unsubscribe();
      };
    }, [setFallBakList, tokenListState.type])
  );

  const combineListData = () => {
    if (tokenListState.type === 'scan') {
      return nativeToken ? [nativeToken, ...(ERC20TokenList || [])] : ERC20TokenList || [];
    } else {
      // if state is fallback ,then combine fallback list and scan list
      if (ERC20TokenList === null || ERC20TokenList.length === 0) {
        return nativeToken ? [nativeToken, ...(fallBackList.list || [])] : fallBackList.list;
      } else {
        // try to scan token list get icon url
        const hashList = fallBackList.list.reduce((acc, cur) => {
          acc[cur.contract] = cur;
          return acc;
        }, {} as Record<string, AccountTokenListItem>);

        ERC20TokenList.forEach((item) => {
          if (hashList[item.contract]) {
            hashList[item.contract].iconUrl = item.iconUrl;
          }
        });
        const list = Object.values(hashList);
        return nativeToken ? [nativeToken, ...(list || [])] : list;
      }
    }
  };

  const list = combineListData();

  return list.length === 0 ? (
    <View className="flex-1 px-6 py-4">
      <SkeletonList length={skeleton} />
    </View>
  ) : (
    <FlatList
      onEndReached={handleLoadMore}
      // onEndReachedThreshold={0.5}
      // onViewableItemsChanged={onViewCallBack}
      className="flex flex-1 px-6 py-4"
      data={combineListData()}
      renderItem={({ item }) => <TokenItem data={item} onPress={onPress ? onPress : undefined} />}
    />
  );
};

export default TokenList;
