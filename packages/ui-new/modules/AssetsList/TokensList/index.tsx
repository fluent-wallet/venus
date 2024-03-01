import React from 'react';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { useAssetsTokenList, useIsTokensEmpty } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import ReceiveFunds from './ReceiveFunds';
import Skeleton from './Skeleton';

interface Props {
  onPress?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  hidePrice?: boolean;
}

const TokenList: React.FC<Props> = ({ onPress, showReceiveFunds = false, hidePrice = false }) => {
  const tokens = useAssetsTokenList();
  const isEmpty = useIsTokensEmpty();

  if (tokens === null) {
    return Skeleton;
  }

  if (showReceiveFunds && isEmpty) {
    return <ReceiveFunds />;
  }

  return tokens.map((token, index) => <TokenItem key={index} hidePrice={hidePrice} data={token} onPress={onPress} />);
};

type FlashProps = FlashListProps<any> & Props;

export const FlashTokenList: React.FC<Omit<FlashProps, 'data' | 'renderItem' | 'estimatedItemSize'>> = ({
  onPress,
  showReceiveFunds = false,
  hidePrice = false,
  ...props
}) => {
  const tokens = useAssetsTokenList();
  const isEmpty = useIsTokensEmpty();

  if (tokens === null) {
    return null;
  }

  if (showReceiveFunds && isEmpty) {
    return <ReceiveFunds />;
  }

  return (
    <FlashList
      {...props}
      estimatedItemSize={70}
      data={tokens}
      renderItem={({ item }) => {
        return <TokenItem hidePrice={hidePrice} data={item} onPress={onPress} />;
      }}
    />
  );
};

export default TokenList;
