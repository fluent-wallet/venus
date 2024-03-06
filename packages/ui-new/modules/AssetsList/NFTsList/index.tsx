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

interface Props {
  onPress?: (v: AssetInfo) => void;
  tabsType: TabsType;
}

const NFTList: React.FC<Props> = ({ onPress, tabsType }) => {
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
        <NoData style={styles.noNFTIcon} />
        <Text style={[styles.noNFT, { color: colors.textSecondary }]}>No NFT</Text>
      </>
    );
  }

  return nfts.map((nft, index) => <NFTItem key={index} data={nft} onPress={onPress} currentOpenNFTDetail={currentOpenNFTDetail} index={index} tabsType={tabsType} />);
};

const styles = StyleSheet.create({
  noNFTIcon: {
    marginTop: 24,
    marginBottom: 6,
    alignSelf: 'center',
  },
  noNFT: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default NFTList;
