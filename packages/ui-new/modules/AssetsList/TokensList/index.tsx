import React from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@react-navigation/native';
import { useAssetsTokenList, useIsAssetsEmpty } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import ReceiveFunds from './ReceiveFunds';

const TokenList: React.FC<{
  onPress?: (v: AssetInfo) => void;
  skeleton?: number;
  showReceiveFunds?: boolean;
  hidePrice?: boolean;
}> = ({ onPress, showReceiveFunds = false, hidePrice = false }) => {
  const { colors } = useTheme();

  const tokens = useAssetsTokenList();
  const isEmpty = useIsAssetsEmpty();

  if (tokens === null) {
    return null;
  }

  if (showReceiveFunds && isEmpty) {
    return <ReceiveFunds />;
  }

  return (
    <FlashList
      estimatedItemSize={70}
      data={tokens}
      renderItem={({ item }) => {
        return <TokenItem hidePrice={hidePrice} data={item} onPress={onPress} />;
      }}
    />
  );
};

export default TokenList;
