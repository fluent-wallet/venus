import { FlatList, View, Image, Pressable } from 'react-native';
import { Text, useTheme } from '@rneui/themed';
import { firstValueFrom, map } from 'rxjs';
import PriceGainIcon from '@assets/icons/priceGain.svg';
import PriceDeclineIcon from '@assets/icons/priceDecline.svg';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';
import { useAtom } from 'jotai';
import { ERC20tokenListAtom, AccountTokenListItem, requestTokenList } from '../../hooks/useTokenList';
import { formatUnits } from 'ethers';
import { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { Database } from '@nozbe/watermelondb';
import { querySelectedAddress } from '@core/DB/models/Address/service';
import { Address } from '@core/DB/models/Address';
import { useEffect } from 'react';
import { TokenType } from '@hooks/useTransaction';

const TokenList: React.FC<{ address: Address; onPress?: (v: AccountTokenListItem) => void }> = ({ address, onPress }) => {
  const { theme } = useTheme();
  const [tokenList, setTokenList] = useAtom(ERC20tokenListAtom);
  useEffect(() => {
    firstValueFrom(requestTokenList(address.hex, TokenType.ERC20)).then((list) => {
      setTokenList(list);
    });
  }, [setTokenList, address]);
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

export default withDatabase(
  withObservables([], ({ database }: { database: Database }) => {
    const address = querySelectedAddress(database).observe();
    return {
      address: address.pipe(map((address) => address[0])),
    };
  })(TokenList)
);
