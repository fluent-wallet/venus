import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAssetsNFTList, useIsNftsEmpty, useCurrentOpenNFTDetail } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import Text from '@components/Text';
import { type TabsType } from '@modules/AssetsTabs';
import NoData from '@assets/icons/no-data.svg';
import NFTItem from './NFTItem';
import { SkeletonList } from './Skeleton';
import Img from '@assets/images/home-receive.webp';
import { Image } from 'expo-image';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  tabsType: TabsType;
}

const NFTList: React.FC<Props> = ({ onPressItem, tabsType }) => {
  const { colors } = useTheme();
  const nfts = useAssetsNFTList();
  const isEmpty = useIsNftsEmpty();
  const currentOpenNFTDetail = useCurrentOpenNFTDetail();

  if (nfts === null) {
    return SkeletonList;
  }

  if (isEmpty) {
    return (
      <>
        <Image style={styles.img} source={Img} contentFit="contain" />
        <Text style={[styles.noNFTText, { color: colors.textSecondary }]}>No NFT</Text>
      </>
    );
  }

  return nfts.map((nft, index) => (
    <NFTItem key={index} data={nft} onPress={onPressItem} currentOpenNFTDetail={currentOpenNFTDetail} index={index} tabsType={tabsType} />
  ));
};

const styles = StyleSheet.create({
  noNFTIcon: {
    marginTop: 24,
    marginBottom: 6,
    alignSelf: 'center',
  },
  noNFTText: {
    fontSize: 14,
    textAlign: 'center',
  },
  img: {
    alignSelf: 'center',
    width: 160,
    aspectRatio: 1,
    marginTop: 36,
  },
});

export default NFTList;
