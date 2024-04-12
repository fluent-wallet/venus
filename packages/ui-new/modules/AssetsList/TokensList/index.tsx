import React from 'react';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { useAssetsTokenList, useIsTokensEmpty, useTokenListOfCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import Text from '@components/Text';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import NoneToken from '@assets/images/none-token.webp';
import TokenItem from './TokenItem';
import ReceiveFunds, { styles } from './ReceiveFunds';
import Skeleton from './Skeleton';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  selectType: 'Home' | 'Send' | 'Receive';
}

const TokensList: React.FC<Props> = ({ onPressItem, selectType, showReceiveFunds = false }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const tokens = (selectType === 'Receive' ? useTokenListOfCurrentNetwork : useAssetsTokenList)();
  const isEmpty = useIsTokensEmpty();
  const priceVisible = usePriceVisibleValue();

  if (tokens === null) {
    return <Skeleton />;
  }

  if (selectType !== 'Receive' && isEmpty) {
    if (showReceiveFunds) {
      return <ReceiveFunds />;
    } else {
      return (
        <>
          <Image style={styles.noneImg} source={NoneToken} contentFit="contain" />
          <Text style={[styles.noneText, { color: colors.textSecondary }]}>{t('tab.content.noToken')}</Text>
        </>
      );
    }
  }

  return tokens.map((token, index) => (
    <TokenItem
      key={index}
      hidePrice={selectType === 'Receive' ? true : selectType === 'Home' ? (!priceVisible ? 'encryption' : false) : false}
      hideBalance={selectType === 'Receive' ? true : selectType === 'Home' ? (!priceVisible ? 'encryption' : false) : false}
      showAddress={selectType === 'Receive'}
      data={token}
      onPress={onPressItem}
    />
  ));
};

export default TokensList;
