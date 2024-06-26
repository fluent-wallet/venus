import NoneNFT from '@assets/images/none-NFT.webp';
import Text from '@components/Text';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useAssetsNFTList, useCurrentOpenNFTDetail, useIsNftsEmpty } from '@core/WalletCore/Plugins/ReactInject';
import type { TabsType } from '@modules/AssetsTabs';
import { useTheme } from '@react-navigation/native';
import { Image } from 'expo-image';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { styles } from '../TokensList/ReceiveFunds';
import NFTItem from './NFTItem';
import { SkeletonList } from './Skeleton';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  tabsType: TabsType;
}

const NFTList: React.FC<Props> = ({ onPressItem, tabsType }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const nfts = useAssetsNFTList();
  const isEmpty = useIsNftsEmpty();
  const currentOpenNFTDetail = useCurrentOpenNFTDetail();

  if (nfts === null) {
    return <SkeletonList />;
  }

  if (isEmpty) {
    return (
      <>
        <Image style={styles.noneImg} source={NoneNFT} contentFit="contain" />
        <Text style={[styles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noNFT')}</Text>
      </>
    );
  }

  return nfts.map((nft, index) => (
    <NFTItem key={index} data={nft} onPress={onPressItem} currentOpenNFTDetail={currentOpenNFTDetail} index={index} tabsType={tabsType} />
  ));
};

export default NFTList;
