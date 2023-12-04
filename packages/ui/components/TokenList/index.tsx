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
  readAndWriteERC20TokenListFailBackListAtom,
  tokenListStateAtom,
  scanERC20ListSubject,
  loopFailBackListTask,
  failBackListSubject,
} from '@hooks/useTokenList';

import TokenItem from './TokenItem';
import { useTheme } from '@rneui/themed';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void }> = ({ onPress }) => {
  const { theme } = useTheme();
  const [tokenListState, setTokenListState] = useAtom(tokenListStateAtom);

  const [failBackList, setFailBakList] = useAtom(readAndWriteERC20TokenListFailBackListAtom);
  const loadingMore = useRef(false);

  const [nativeToken] = useAtom(nativeTokenAtom);

  const [ERC20TokenList, setERC20TokenList] = useAtom(ERC20tokenListAtom);

  const [_, writeNFTTokenList] = useAtom(writeNativeAndNFTTokenListAtom);

  const getFailBackList = useCallback(
    (page = 1) => {
      loadingMore.current = true;
      getERC20ByWalletContract(page)
        .then((res) => {
          const { total, list } = res;
          setFailBakList((v) => ({ ...v, total, page: v.page + 1, list: [...v.list, ...list] }));
        })
        .finally(() => {
          loadingMore.current = false;
        });
    },
    [setFailBakList]
  );

  const handleLoadMore = () => {
    const { page, pageSize, total } = failBackList;
    const skip = (page - 1) * pageSize;
    if (skip >= total || loadingMore.current || tokenListState.type === 'scan') return;
    getFailBackList(page);
  };

  useFocusEffect(
    useCallback(() => {
      // loop and check scan api
      const subscribe = loopERC20ListTask.subscribe({
        next: (res) => {
          if (res === null) {
            setTokenListState({ type: 'failBack' }); // set type to failBack
            // then start loop check every 30 seconds
            console.log('loop is next', 30);
            scanERC20ListSubject.next({ delay: 30 * 1000 });
          } else {
            setTokenListState({ type: 'scan' });
            setERC20TokenList(res);
            // if ok loop  every 5 seconds
            console.log('loop is next', 5);
            scanERC20ListSubject.next({ delay: 5 * 1000 });
          }
        }
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
      const subscribe = loopNative721And1155List.subscribe((res) => {
        writeNFTTokenList(res);
      });
      return () => {
        subscribe.unsubscribe();
      };
    }, [writeNFTTokenList])
  );

  useFocusEffect(
    useCallback(() => {
      // if state is fail back ,then call contract api to get token list
      if (tokenListState.type === 'failBack') {
        getERC20ByWalletContract(1).then((res) => {
          const { total, list } = res;
          setFailBakList((v) => ({ ...v, total, page: v.page + 1, list: [...list] }));
        });
      }
    }, [tokenListState.type, setFailBakList])
  );

  useFocusEffect(
    useCallback(() => {
      // if state is fail back ,then loop to call contract api to get token list
      if (tokenListState.type !== 'failBack') return;
      const subscribe = loopFailBackListTask.subscribe({
        next: (newList) => {
          setFailBakList((v) => ({ ...v, list: newList }));
          //if state is fail back loop list  every 5 seconds
          failBackListSubject.next({ delay: 5 * 1000 });
        },
      });

      failBackListSubject.next({ delay: 0 });
      return () => {
        subscribe.unsubscribe();
      };
    }, [setFailBakList, tokenListState.type])
  );

  const combineListData = () => {
    if (tokenListState.type === 'scan') {
      return nativeToken ? [nativeToken, ...(ERC20TokenList || [])] : ERC20TokenList || [];
    } else {
      // if state is fail back ,then combine fail back list and scan list
      if (ERC20TokenList === null || ERC20TokenList.length === 0) {
        return nativeToken ? [nativeToken, ...(failBackList.list || [])] : failBackList.list;
      } else {
        // try to scan token list get icon url
        const hashList = failBackList.list.reduce((acc, cur) => {
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
    <ActivityIndicator color={theme.colors.contrastWhiteAndBlack} size={'large'} />
  ) : (
    <FlatList
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.5}
      // onViewableItemsChanged={onViewCallBack}
      className="flex flex-1 px-6 py-4"
      data={combineListData()}
      renderItem={({ item }) => <TokenItem data={item} onPress={onPress ? onPress : undefined} />}
    />
  );
};

export default TokenList;
