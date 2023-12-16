import { Text, useTheme, Skeleton } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { Image, Pressable } from 'react-native';
import { View } from 'react-native';
import { useMemo } from 'react';
import { formatValue } from '@utils/formatValue';
import { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import TokenIcon from '@components/TokenIcon';

const TokenItem: React.FC<{
  data: AssetInfo;
  onPress?: (v: AssetInfo) => void;
}> = ({ onPress, data }) => {
  const { theme } = useTheme();

  const viewValue = useMemo(() => formatValue(data.balance, data.decimals), [data.balance, data.decimals]);
  return (
    <Pressable onPress={onPress && data ? () => onPress(data) : undefined}>
      <View className={'flex flex-row  w-full p-3'}>
        <View className="w-12 h-12 mr-4">
          <TokenIcon type={data.type} url={data.icon} width={48} height={48} />
        </View>
        <View className="flex-1">
          <View className="flex flex-row flex-1 items-center justify-between">
            <View className="flex-1">
              <Text className="text-base leading-5 " numberOfLines={1}>
                {data.name}
              </Text>
            </View>
            <View className=" ml-2">
              <Text className="text-base">
                {data.priceInUSDT ? `$${(Number(formatUnits(data.balance, data.decimals)) * Number(data.priceInUSDT)).toFixed(2)}` : '--'}
              </Text>
            </View>
          </View>
          <View className="flex-1">
            <Text style={{ color: theme.colors.textSecondary }} numberOfLines={1}>
              {viewValue} {data.symbol}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default TokenItem;
