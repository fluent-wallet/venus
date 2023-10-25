import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text, useTheme } from '@rneui/themed';

import PriceGainIcon from '@assets/icons/priceGain.svg';
import PriceDeclineIcon from '@assets/icons/priceDecline.svg';
import TokenIconBTC from '@assets/icons/tokenBTC.svg';
import TokenIconAPE from '@assets/icons/tokenAPE.svg';
import TokenIconETH from '@assets/icons/tokenETH.svg';
import TOkenIconMATIC from '@assets/icons/tokenMATIC.svg';
import TokenIconUSDT from '@assets/icons/tokenUSDT.svg';

const WalletTokens: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState([
    {
      tokenName: 'Bitcoin',
      tokenSymbol: 'BTC',
      tokenIcon: TokenIconBTC,
      tokenValue: '20000000',
      tokenBalance: 0,
      changeType: 'gain',
      changePercent: 1.5,
      key: 'BTC',
    },
    {
      tokenName: 'Apecoin',
      tokenSymbol: 'APE',
      tokenIcon: TokenIconAPE,
      tokenValue: '0.829416',
      tokenBalance: 0,
      changeType: 'gain',
      changePercent: 1.5,
      key: 'APE',
    },
    {
      tokenName: 'Ethereum',
      tokenSymbol: 'ETH',
      tokenIcon: TokenIconETH,
      tokenValue: '20000000',
      tokenBalance: 0,
      changeType: 'decline',
      changePercent: 1.5,
      key: 'ETH',
    },
    {
      tokenName: 'Polygon',
      tokenSymbol: 'MATIC',
      tokenIcon: TOkenIconMATIC,
      tokenValue: '20000000',
      tokenBalance: 0,
      changeType: 'gain',
      changePercent: 1.5,
      key: 'MATIC',
    },
    {
      tokenName: 'Tether',
      tokenSymbol: 'USDT',
      tokenIcon: TokenIconUSDT,
      tokenValue: '20000000',
      tokenBalance: 0,
      changeType: 'gain',
      changePercent: 1.5,
      key: 'USDT',
    },
  ]);

  return (
    <FlatList
      data={data}
      renderItem={({ item: { tokenName, tokenSymbol, tokenIcon: TokenIcon, tokenValue, tokenBalance, changeType, changePercent } }) => (
        <View className="flex flex-row w-full justify-between p-[11px] ">
          <View className="flex flex-row items-center">
            <TokenIcon width={48} height={48} />
            <View className="ml-[15px]">
              <Text className="text-base leading-5">{tokenName}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                {tokenBalance}
                {tokenSymbol}
              </Text>
            </View>
          </View>
          <View className="flex items-end ">
            <Text className="text-base">${tokenValue}</Text>
            <View className="flex flex-row">
              <View className="self-end">{changeType === 'gain' ? <PriceGainIcon /> : <PriceDeclineIcon />}</View>
              <Text style={{ color: changeType === 'gain' ? theme.colors.warnSuccessPrimary : theme.colors.warnErrorPrimary }}>{changePercent}%</Text>
            </View>
          </View>
        </View>
      )}
    />
  );
};

export default WalletTokens;
