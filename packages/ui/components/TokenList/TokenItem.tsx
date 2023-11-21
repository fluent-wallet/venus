import { Text, useTheme, Skeleton } from '@rneui/themed';
import { formatUnits } from 'ethers';
import { Image, Pressable } from 'react-native';
import { View } from 'react-native';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import { nativeAndERC20tokenListAtom, AccountTokenListItem } from '../../hooks/useTokenList';
import { useAtom } from 'jotai';

import { useEffect } from 'react';
import { TokenType } from '@hooks/useTransaction';
import { RPCResponse, RPCSend } from '@core/utils/send';
import { useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';

const TokenItem: React.FC<{
  placeholder?: boolean;
  data?: AccountTokenListItem;
  onPress?: (v: AccountTokenListItem) => void;
}> = ({ onPress, data, placeholder = false }) => {
  const { theme } = useTheme();
  const [_, setNativeAndERC20TokenList] = useAtom(nativeAndERC20tokenListAtom);
  const currentNetwork = useCurrentNetwork()!;
  const address = useCurrentAddress()!;
  const isRenderData = data && !placeholder;

  useEffect(() => {
    if (data?.type && data.type === TokenType.NATIVE) {
      RPCSend<RPCResponse<string>>(currentNetwork.endpoint, { method: 'eth_getBalance', params: [address.hex, 'latest'] }).subscribe((res) => {
        if (res.result) {
          setNativeAndERC20TokenList((prev) => {
            if (prev === null) return prev;
            const newList = prev.map((item) => {
              if (item.type === TokenType.NATIVE) {
                return {
                  ...item,
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
      <View className={'flex flex-row w-full justify-between p-3'}>
        <View className="flex flex-row items-center">
          {isRenderData ? (
            data.iconUrl ? (
              <Image source={{ uri: data.iconUrl }} width={48} height={48} />
            ) : (
              <TokenIconDefault width={48} height={48} />
            )
          ) : (
            <Skeleton width={48} height={48} circle />
          )}

          <View className="ml-[15px]">
            <Text className="text-base leading-5">{isRenderData ? data.name : <Skeleton width={100} height={24} />}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>
              {isRenderData ? formatUnits(data.amount, data.decimals) : <Skeleton width={100} height={24} />}
              {isRenderData ? data.symbol : ''}
            </Text>
          </View>
        </View>
        <View className="flex items-end ">
          <Text className="text-base">
            {isRenderData ? (
              data.priceInUSDT ? (
                `$${(Number(formatUnits(data.amount, data.decimals)) * Number(data.priceInUSDT)).toFixed(2)}`
              ) : (
                '--'
              )
            ) : (
              <Skeleton width={100} height={24} />
            )}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export default TokenItem;
