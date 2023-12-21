import { FlatList, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import SkeletonList from './SkeletonList';
import ReceiveFunds from './ReceiveFunds';

const TokenList: React.FC<{
  onPress?: (v: AssetInfo) => void;
  skeleton?: number;
  RenderList?: typeof FlatList | typeof BottomSheetFlatList;
  enableEmpty?: boolean;
}> = ({ onPress, skeleton = 8, RenderList = FlatList, enableEmpty = false }) => {
  const tokens = useAssetsTokenList();
  const empty = !tokens || tokens.every((v) => BigInt(v.balance) <= 0);
  if (tokens === null) {
    return (
      <View className="flex-1 px-6 py-4">
        <SkeletonList length={skeleton} />
      </View>
    );
  }
  if (empty && enableEmpty) {
    return (
      <View className="flex-1 px-6 py-4">
        <ReceiveFunds />
      </View>
    );
  }
  return (
    <RenderList className="flex flex-1 px-6 py-4" data={tokens} renderItem={({ item }) => <TokenItem data={item} onPress={onPress ? onPress : undefined} />} />
  );
};

export default TokenList;
