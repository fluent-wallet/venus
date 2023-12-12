import { Text, useTheme, Skeleton } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { Image, Pressable } from 'react-native';
import { View } from 'react-native';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import { ERC20tokenListAtom, AccountTokenListItem } from '../../hooks/useTokenList';
import { useAtom } from 'jotai';

import { useEffect, useMemo } from 'react';
import { RPCResponse, RPCSend } from '@core/utils/send';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import MixinImage from '@components/MixinImage';
import { AssetType } from '@core/database/models/Asset';
import { formatValue } from '@utils/formatValue';

const TokenItem: React.FC<{
  data: AccountTokenListItem;
  onPress?: (v: AccountTokenListItem) => void;
}> = ({ onPress, data }) => {
  const { theme } = useTheme();
  const [_, setNativeAndERC20TokenList] = useAtom(ERC20tokenListAtom);
  const currentNetwork = useCurrentNetwork()!;
  const address = useCurrentAddress()!;

  const viewValue = useMemo(() => formatValue(data.balance, data.decimals), [data.balance, data.decimals]);

  useEffect(() => {
    if (data?.type && data.type === AssetType.Native) {
      RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getBalance', params: [address?.hex, 'latest'] }).subscribe((res) => {
        if (res.result) {
          setNativeAndERC20TokenList((prev) => {
            if (prev === null) return prev;
            const newList = prev.map((item) => {
              if (item.type === AssetType.Native) {
                return {
                  ...item,
                  type: AssetType.Native,
                  amount: res.result,
                };
              }
              return item;
            });
            return newList;
          });
        }
      });
    }
  }, [currentNetwork.endpoint, data?.type, address, setNativeAndERC20TokenList]);

  return (
    <Pressable onPress={onPress && data ? () => onPress(data) : undefined}>
      <View className={'flex flex-row  w-full p-3'}>
        <View className="w-12 h-12 mr-4">
          {data.iconUrl ? (
            <MixinImage
              source={{ uri: data.iconUrl, width: 48, height: 48 }}
              fallback={<TokenIconDefault width={48} height={48} />}
              width={48}
              height={48}
              resizeMode="center"
            />
          ) : (
            <TokenIconDefault width={48} height={48} />
          )}
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
