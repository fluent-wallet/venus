import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ScrollView, View, TouchableHighlight, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import clsx from 'clsx';
import { Icon } from '@rneui/base';
import { useTheme, Text, ListItem } from '@rneui/themed';
import { useCurrentAddress, useCurrentNetwork, useAssetsNFTList } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import Skeleton from '@components/Skeleton';
import MixinImage from '@components/MixinImage';
import TokenIconDefault from '@assets/icons/defaultToken.svg';
import NFTItem from './NFTItem';

export interface NFTItemDetail {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
}

export type NFTWithDetail = AssetInfo & { detail: NFTItemDetail };

const NftItemHeight = 63;

const ESpaceNFTList: React.FC<{ onSelectNftItem?: (nft: NFTWithDetail) => void }> = ({ onSelectNftItem }) => {
  const { theme } = useTheme();

  const scrollY = useRef(0);
  const nfts = useAssetsNFTList();
  const currentAddress = useCurrentAddress()!;
  const currentNetwork = useCurrentNetwork()!;
  const [currentOpenNftContract, _setCurrentOpenNftContract] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentOpenNft = useMemo(() => nfts?.find((nft) => nft.contractAddress === currentOpenNftContract), [currentOpenNftContract]);
  const currentOpenNftPosition = useMemo(() => {
    const index = nfts?.findIndex((nft) => nft.contractAddress === currentOpenNftContract);
    if (typeof index !== 'number') return null;
    return index * NftItemHeight;
  }, [currentOpenNftContract, nfts]);

  const [isCurrentOpenNftInFetch, setCurrentOpenNftInFetch] = useState(true);
  const [isCurrentOpenHeaderInView, setCurrentOpenHeaderInView] = useState(true);
  const setCurrentOpenNftContract = useCallback(
    (nftContract: string | null) => {
      let resultNftContract: string | null = null;
      _setCurrentOpenNftContract((pre) => {
        if (nftContract === null) {
          resultNftContract = null;
        } else {
          if (pre === nftContract) {
            resultNftContract = null;
          } else {
            resultNftContract = nftContract;
          }
        }
        return resultNftContract;
      });

      if (resultNftContract === null) {
        setCurrentOpenHeaderInView(true);
      } else {
        const index = nfts?.findIndex((nft) => nft.contractAddress === resultNftContract) ?? 0;
        if (scrollY.current > index * NftItemHeight) {
          setCurrentOpenHeaderInView(false);
        } else {
          setCurrentOpenHeaderInView(true);
        }
      }
    },
    [nfts]
  );

  useEffect(() => {
    setCurrentOpenNftContract(null);
  }, [currentNetwork?.chainId, currentAddress?.hex, setCurrentOpenNftContract]);

  const handleScroll = useCallback(
    (evt: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = evt.nativeEvent.contentOffset.y;
      if (currentOpenNftPosition === null) return;
      if (scrollY.current > currentOpenNftPosition) {
        setCurrentOpenHeaderInView(false);
      } else {
        setCurrentOpenHeaderInView(true);
      }
    },
    [currentOpenNftPosition]
  );

  if (!currentAddress || !currentNetwork) {
    return null;
  }

  return (
    <View className="relative flex-1">
      {currentOpenNft && !isCurrentOpenHeaderInView && (
        <TouchableHighlight onPress={() => setCurrentOpenNftContract(null)} underlayColor={theme.colors.underlayColor}>
          <View className={'flex flex-row h-[64px] px-[24px] items-center'}>
            {currentOpenNft.icon ? (
              <MixinImage source={{ uri: currentOpenNft.icon }} width={32} height={32} fallback={<TokenIconDefault width={32} height={32} />} />
            ) : (
              <TokenIconDefault width={32} height={32} />
            )}
            <Text
              style={{ color: theme.colors.contrastWhiteAndBlack }}
              className={clsx('text-base font-medium ml-[8px]', isCurrentOpenNftInFetch ? 'mr-[16px]' : 'mr-auto')}
            >
              {currentOpenNft.name}
            </Text>
            {isCurrentOpenNftInFetch && <ActivityIndicator color={theme.colors.primary} size={16} className="mr-auto" />}

            <View className="rotate-[-180deg]">
              <Icon name="keyboard-arrow-down" color={theme.colors.contrastWhiteAndBlack} />
            </View>
          </View>
        </TouchableHighlight>
      )}

      <ScrollView className="flex-1" onScroll={handleScroll}>
        {nfts === null ? (
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
        ) : (
          nfts.map((nft) => (
            <NFTItem
              data={nft}
              key={`${nft.contractAddress}-${currentAddress?.hex}-${currentNetwork?.chainId}`}
              isExpanded={currentOpenNftContract === nft.contractAddress}
              isCurrentOpenHeaderInView={currentOpenNftContract === nft.contractAddress && isCurrentOpenHeaderInView}
              isCurrentOpenNftInFetch={isCurrentOpenNftInFetch}
              setCurrentOpenNftInFetch={setCurrentOpenNftInFetch}
              onPress={() => setCurrentOpenNftContract(nft.contractAddress!)}
              onSelectNftItem={onSelectNftItem}
              currentNetwork={currentNetwork}
              currentAddress={currentAddress}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default ESpaceNFTList;
