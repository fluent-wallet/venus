import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useAssetsTokenList, useIsTokensEmpty, useTokenListOfCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import Text from '@components/Text';
import { usePriceVisibleValue } from '@hooks/usePriceVisible';
import NoData from '@assets/icons/no-data.svg';
import TokenItem from './TokenItem';
import ReceiveFunds from './ReceiveFunds';
import Skeleton from './Skeleton';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  selectType: 'Home' | 'Send' | 'Receive';
}

const TokensList: React.FC<Props> = ({ onPressItem, selectType, showReceiveFunds = false }) => {
  const { colors } = useTheme();
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
          <NoData style={styles.noTokenIcon} />
          <Text style={[styles.noTokenText, { color: colors.textSecondary }]}>No Token</Text>
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

const styles = StyleSheet.create({
  noTokenIcon: {
    marginTop: 24,
    marginBottom: 6,
    alignSelf: 'center',
  },
  noTokenText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default TokensList;
