import React from 'react';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { useAssetsTokenList, useIsTokensEmpty, useTokenListOfCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import ReceiveFunds from './ReceiveFunds';
import Skeleton from './Skeleton';

interface Props {
  onPressItem?: (v: AssetInfo) => void;
  showReceiveFunds?: boolean;
  hidePrice?: boolean;
  selectType?: 'Send' | 'Receive';
}

const TokenList: React.FC<Props> = ({ onPressItem, selectType = 'Send', showReceiveFunds = false, hidePrice = false }) => {
  const tokens = (selectType === 'Send' ? useAssetsTokenList : useTokenListOfCurrentNetwork)();
  const isEmpty = useIsTokensEmpty();
  if (tokens === null) {
    return Skeleton;
  }

  if (showReceiveFunds && isEmpty) {
    return <ReceiveFunds />;
  }

  return tokens.map((token, index) => (
    <TokenItem
      key={index}
      hidePrice={selectType === 'Receive' ? true : hidePrice}
      hideBalance={selectType === 'Receive'}
      showAddress={selectType === 'Receive'}
      data={token}
      onPress={onPressItem}
    />
  ));
};

type FlashProps = FlashListProps<any> & Props;

export const FlashTokenList: React.FC<Omit<FlashProps, 'data' | 'renderItem' | 'estimatedItemSize'>> = ({
  onPressItem,
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
        return <TokenItem hidePrice={hidePrice} data={item} onPress={onPressItem} />;
      }}
    />
  );
};

export default TokenList;
