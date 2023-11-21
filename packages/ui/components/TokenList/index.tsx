import { useEffect } from 'react';
import { FlatList, View, Image, Pressable } from 'react-native';
import { firstValueFrom } from 'rxjs';
import { useAtom } from 'jotai';
import { formatUnits } from 'ethers';
import { Text, useTheme } from '@rneui/themed';
import { useCurrentAddress } from '@core/WalletCore/Plugins/ReactInject';
import { ERC20tokenListAtom, AccountTokenListItem, requestTokenList } from '@hooks/useTokenList';
import { TokenType } from '@hooks/useTransaction';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';

const TokenList: React.FC<{ onPress?: (v: AccountTokenListItem) => void }> = ({ onPress }) => {
  const { theme } = useTheme();
  const [tokenList, setTokenList] = useAtom(ERC20tokenListAtom);
  const currentAddress = useCurrentAddress();
  useEffect(() => {
    if (!currentAddress) return;
    firstValueFrom(requestTokenList(currentAddress.hex, TokenType.ERC20)).then((list) => {
      setTokenList(list);
    });
  }, [setTokenList, currentAddress]);

  return (
    <FlatList
      className="flex flex-1 px-6 py-4"
      data={tokenList}
      renderItem={({ item }) => (
        <Pressable onPress={onPress ? () => onPress(item) : undefined}>
          <View className={'flex flex-row w-full justify-between p-3'}>
            <View className="flex flex-row items-center">
              {item.iconUrl ? <Image source={{ uri: item.iconUrl }} width={48} height={48} /> : <TokenIconDefault width={48} height={48} />}

              <View className="ml-[15px]">
                <Text className="text-base leading-5">{item.name}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {formatUnits(item.amount, item.decimals)}
                  {item.symbol}
                </Text>
              </View>
            </View>
            <View className="flex items-end ">
              <Text className="text-base">{item.priceInUSDT ? `$${Number(formatUnits(item.amount, item.decimals)) * Number(item.priceInUSDT)}` : '--'}</Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
};

export default TokenList;
