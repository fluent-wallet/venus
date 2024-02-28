import { useEffect, useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { ScrollView, View, TouchableHighlight, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Icon } from '@rneui/base';
import { useTheme, Text } from '@rneui/themed';
import { useCurrentAddress, useCurrentNetwork, useAssetsNFTList } from '@core/WalletCore/Plugins/ReactInject';
import Skeleton from '@components/Skeleton';
import MixinImage from '@components/MixinImage';
import NoDataIcon from '@assets/icons/no_data.svg';
import DefaultNFTAvatar from '@assets/icons/defaultNFT.svg';
import NFTItem from './NFTItem';
import { fetchNFTDetail, fetchNFTDetailSubject, type NFTItemDetail, type NFTWithDetail } from './fetch';
import SkeletonList from '../TokenList/SkeletonList';

const NftItemHeight = 71;

export interface ESpaceNFTListMethods {
  handleScroll: (evt: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ESpaceNFTList = forwardRef<ESpaceNFTListMethods, { onSelectNftItem?: (nft: NFTWithDetail) => void; scrollStartOffset?: number }>(
  ({ onSelectNftItem, scrollStartOffset = 0 }, ref) => {
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
      return index * NftItemHeight + scrollStartOffset;
    }, [currentOpenNftContract, nfts, scrollStartOffset]);

    const [details, setDetails] = useState<Array<NFTItemDetail> | null>(null);
    const [isCurrentOpenNftInFetch, setCurrentOpenNftInFetch] = useState(true);
    // eslint-disable-next-line @typescript-eslint/ban-types
    const fetchCurrentNFTDetail = useRef<Function | null>(null);

    useEffect(() => {
      if (!currentOpenNft) {
        fetchCurrentNFTDetail.current = null;
      } else {
        fetchCurrentNFTDetail.current = () => {
          setCurrentOpenNftInFetch(true);
          return fetchNFTDetail({ currentAddress, currentNetwork, nft: currentOpenNft! })
            .then((res) => setDetails(res))
            .finally(() => setCurrentOpenNftInFetch(false));
        };
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAddress?.hex, currentNetwork?.id, currentOpenNft]);

    useEffect(() => {
      setDetails(null);
      if (currentOpenNft && fetchCurrentNFTDetail.current) {
        fetchCurrentNFTDetail.current();
      }
    }, [currentOpenNft?.contractAddress, currentAddress?.hex, currentNetwork?.id]);

    useEffect(() => {
      const subscrition = fetchNFTDetailSubject.subscribe((nftContractAddress) => {
        if (
          currentOpenNft &&
          fetchCurrentNFTDetail.current &&
          (!nftContractAddress || (typeof nftContractAddress === 'string' && nftContractAddress === currentOpenNft.contractAddress))
        ) {
          fetchCurrentNFTDetail.current();
        }
      });
      return () => {
        subscrition.unsubscribe();
      };
    }, [currentOpenNft]);

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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentNetwork?.chainId, currentAddress?.hex]);

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

    useImperativeHandle(ref, () => ({
      handleScroll,
    }));

    if (!currentAddress || !currentNetwork) {
      return null;
    }

    if (nfts === null) {
      return (
        <View className="flex-1">
          <SkeletonList length={6} />
        </View>
      );
    }

    if (nfts.length === 0) {
      return (
        <View className="flex-1 flex flex-col items-center pt-[34px]">
          <NoDataIcon />
          <Text className="mt-[2px] text-[14px] leading-[22px] opacity-40" style={{ color: theme.colors.textBrand }}>
            No NFT
          </Text>
        </View>
      );
    }

    return (
      <>
        {currentOpenNft && !isCurrentOpenHeaderInView && (
          <TouchableHighlight
            testID="currentOpenNFT"
            onPress={() => setCurrentOpenNftContract(null)}
            underlayColor={theme.colors.underlayColor}
            className="rounded-b-[10px] border-b-[1px]"
            style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.borderSecondary }}
          >
            <View className={'relative flex flex-row items-center w-full h-[72px] px-[24px]'}>
              {currentOpenNft.icon ? (
                <MixinImage
                  source={{ uri: currentOpenNft.icon }}
                  width={32}
                  height={32}
                  className="rounded-full"
                  fallback={<DefaultNFTAvatar className="rounded-full" width={32} height={32} />}
                />
              ) : (
                <DefaultNFTAvatar className="rounded-full" width={32} height={32} />
              )}
              <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium ml-[8px] mr-auto">
                {currentOpenNft.name}
              </Text>

              <View className="rotate-[-180deg]">
                <Icon name="keyboard-arrow-down" color={theme.colors.surfaceFourth} />
              </View>
              <View className="absolute top-0 left-0 w-[120%] h-[1px]" style={{ backgroundColor: theme.colors.borderSecondary }} />
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
            nfts.map((nft, index) => (
              <NFTItem
                data={nft}
                key={`${nft.contractAddress}-${currentAddress?.hex}-${currentNetwork?.chainId}`}
                isExpanded={currentOpenNftContract === nft.contractAddress}
                details={currentOpenNftContract === nft.contractAddress ? details : null}
                isCurrentOpenHeaderInView={currentOpenNftContract === nft.contractAddress && isCurrentOpenHeaderInView}
                isCurrentOpenNftInFetch={isCurrentOpenNftInFetch}
                onPress={() => setCurrentOpenNftContract(nft.contractAddress!)}
                onSelectNftItem={onSelectNftItem}
                index={index}
                nftLength={nfts.length}
              />
            ))
          )}
        </ScrollView>
      </>
    );
  }
);

export default ESpaceNFTList;
