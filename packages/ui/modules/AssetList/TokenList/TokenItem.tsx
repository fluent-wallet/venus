import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import TokenIcon from '@components/TokenIcon';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { balanceFormat, numberWithCommas } from '@core/utils/balance';
import Decimal from 'decimal.js';

const TokenItem: React.FC<{
  data: AssetInfo;
  onPress?: (v: AssetInfo) => void;
  hidePrice?: boolean;
}> = ({ onPress, data, hidePrice = false }) => {
  const { theme } = useTheme();
  const balance = useMemo(() => numberWithCommas(balanceFormat(data.balance, { decimals: data.decimals })), [data.balance, data.decimals]);
  return (
    <Pressable testID="tokenItem" onPress={onPress && data ? () => onPress(data) : undefined}>
      <View className={'flex flex-row  w-full'}>
        <View className="w-12 h-12 mr-4">
          <TokenIcon type={data.type} url={data.icon} width={48} height={48} />
        </View>
        <View className="flex-1">
          <View className="flex flex-row flex-1 items-center justify-between">
            <View className="flex-1">
              <Text className="text-base leading-5 font-medium" numberOfLines={1} style={{ maxWidth: 147 }}>
                {data.name}
              </Text>
            </View>
            {!hidePrice && (
              <View className="ml-2">
                <Text className="text-base font-medium" numberOfLines={1} style={{ maxWidth: 128 }}>
                  {data.priceValue ? `$${data.priceValue}` : '--'}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-1">
            <Text style={{ color: theme.colors.textSecondary, maxWidth: 147 }} numberOfLines={1}>
              {balance} {data.symbol}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default TokenItem;
