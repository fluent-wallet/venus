import { View } from 'react-native';
import clsx from 'clsx';
import { useTheme } from '@rneui/themed';
import { useAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import SkeletonList from './SkeletonList';
import ReceiveFunds from './ReceiveFunds';
import { FlashList } from '@shopify/flash-list';

const TokenList: React.FC<{
  onPress?: (v: AssetInfo) => void;
  skeleton?: number;
  showReceive?: boolean;
  RenderList?: typeof FlashList;
  hidePrice?: boolean;
}> = ({ onPress, skeleton = 6, RenderList = FlashList, showReceive = false, hidePrice = false }) => {
  const { theme } = useTheme();

  const tokens = useAssetsTokenList();
  // const inFetch = useAssetsInFetch();
  const empty = !tokens || tokens.every((v) => BigInt(v?.balance || 0) <= 0);
  
  if (tokens === null) {
    return (
      <View className="flex-1">
        <SkeletonList length={skeleton} />
      </View>
    );
  }

  if (empty && showReceive) {
    return (
      <View className="flex-1">
        <ReceiveFunds />
      </View>
    );
  }

  return (
    <RenderList
      estimatedItemSize={70}
      data={tokens}
      renderItem={({ item, index }) => {
        return (
          <View
            className={clsx(
              'relative flex flex-col justify-center items-center h-[72px] px-[10px] border-l-[1px] border-r-[1px] overflow-hidden',
              index === 0 && 'rounded-t-[10px] border-t-[1px]',
              index === tokens.length - 1 && 'rounded-b-[10px] border-b-[1px]'
            )}
            style={{ backgroundColor: theme.colors.pureBlackAndWight, borderColor: theme.colors.borderSecondary }}
          >
            <TokenItem hidePrice={hidePrice} data={item} onPress={onPress ? onPress : undefined} />
            {index !== 0 && <View className="absolute top-0 left-0 w-[120%] h-[1px]" style={{ backgroundColor: theme.colors.borderSecondary }} />}
          </View>
        );
      }}
    />
  );
};

export default TokenList;
