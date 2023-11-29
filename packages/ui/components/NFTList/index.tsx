import { ScrollView, NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator } from 'react-native';
import { useTheme } from '@rneui/themed';
import { AccountTokenListItem, ERC721And1155TokenListAtom } from '@hooks/useTokenList';
import { useAtom } from 'jotai';
import { NFTItemDetail, NFTItem } from './NFTItem';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';
import { useState } from 'react';

const NFTList: React.FC<{ onPress?: (v: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => void }> = ({ onPress }) => {
  const { theme } = useTheme();
  const [tokenList] = useAtom(ERC721And1155TokenListAtom);
  const address = useCurrentAddress()!;
  const [loadMore, setLoadMore] = useState(false);
  const [currentOpen, setCurrentOpen] = useState<string | null>(null);

  const handleSelectNFT = (token: NFTItemDetail & AccountTokenListItem & { contractName: string; nftName: string }) => {
    if (onPress) {
      onPress(token);
    }
  };
  const handleOnscroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const needMore = event.nativeEvent.contentSize.height - event.nativeEvent.layoutMeasurement.height - event.nativeEvent.contentOffset.y < 500;
    if (!loadMore && needMore) {
      setLoadMore(true);
    } else if (loadMore && !needMore) {
      setLoadMore(false);
    }
  };

  return (
    <ScrollView onScroll={handleOnscroll}>
      {tokenList ? (
        tokenList.map((item) => (
          <NFTItem
            currentOpen={currentOpen}
            setCurrentOpen={setCurrentOpen}
            loadMore={loadMore}
            key={item.contract}
            nftInfo={item}
            ownerAddress={address.hex}
            onPress={handleSelectNFT}
          />
        ))
      ) : (
        <ActivityIndicator size={'large'} color={theme.colors.contrastWhiteAndBlack} />
      )}
    </ScrollView>
  );
};

export default NFTList;
