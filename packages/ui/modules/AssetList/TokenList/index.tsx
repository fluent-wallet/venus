import { StyleProp, View, ViewStyle } from 'react-native';
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
      <View className="flex-1 p-[15px]">
        <SkeletonList length={skeleton} />
      </View>
    );
  }

  if (empty && showReceive) {
    return (
      <View className="flex-1 p-[15px]">
        <ReceiveFunds />
      </View>
    );
  }

  return (
    <View className="flex-1 pb-2 pt-4">
      <RenderList
        estimatedItemSize={20}
        data={tokens}
        renderItem={({ item, index }) => {
          return (
            <View
              className={`p-3 mx-4 ${index === 0 ? 'rounded-t-lg' : ''} ${index === tokens.length - 1 ? 'rounded-b-lg' : ''} ${
                index === tokens.length - 1 ? 'mb-4' : ''
              }}`}
              style={{ backgroundColor: theme.colors.pureBlackAndWight, marginBottom: 1 }}
            >
              <TokenItem hidePrice={hidePrice} data={item} onPress={onPress ? onPress : undefined} />
            </View>
          );
        }}
      />
    </View>
  );
};

export default TokenList;
