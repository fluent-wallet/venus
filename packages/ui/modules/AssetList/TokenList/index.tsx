import { FlatList, ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTheme } from '@rneui/themed';
import { useAssetsTokenList, useAssetsInFetch } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenItem from './TokenItem';
import SkeletonList from './SkeletonList';
import ReceiveFunds from './ReceiveFunds';
import { Card } from '@rneui/themed';

const TokenList: React.FC<{
  onPress?: (v: AssetInfo) => void;
  skeleton?: number;
  RenderList?: typeof FlatList | typeof BottomSheetFlatList;
  enableEmpty?: boolean;
}> = ({ onPress, skeleton = 6, RenderList = FlatList, enableEmpty = false }) => {
  const { theme } = useTheme();

  const tokens = useAssetsTokenList();
  // const inFetch = useAssetsInFetch();
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

  const total = tokens.length;
  return (
    <>
      {/* {inFetch && (
        <View className='absolute left-[118px] -top-[33.5px]'>
          <ActivityIndicator color={theme.colors.textBrand} size={16} className="mr-auto" />
        </View>
      )} */}
      <RenderList
        className="flex flex-1 px-6 py-4"
        data={tokens}
        renderItem={({ item, index }) => {
          const containerStyle: StyleProp<ViewStyle> = {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            paddingBottom: 7,
            paddingTop: 7,
          };
          if (index === 0) {
            delete containerStyle.borderTopLeftRadius;
            delete containerStyle.borderTopRightRadius;
          }
          if (index === total - 1) {
            delete containerStyle.borderBottomLeftRadius;
            delete containerStyle.borderBottomRightRadius;
          }
          return (
            <>
              {index !== 0 && <Card.Divider className="mb-[0px]" />}
              <Card containerStyle={containerStyle}>
                <TokenItem data={item} onPress={onPress ? onPress : undefined} />
              </Card>
            </>
          );
        }}
      />
    </>
  );
};

export default TokenList;
