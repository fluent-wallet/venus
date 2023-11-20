import { useState } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useTheme, Tab, TabView, Text, ListItem, Icon } from '@rneui/themed';
import { RootStackList, SendToStackName, StackNavigation } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { AccountTokenListItem } from '@hooks/useTokenList';
import { TokenType, transactionAtom } from '@hooks/useTransaction';
import NFTList from '@components/NFTList';
import TokenList from '@components/TokenList';
import { NFTItemDetail } from '@components/NFTList/NFTItem';
import { TransactionConfirmStackName } from '../TransactionConfirm';
import TokenIconDefault from '@assets/icons/tokenDefault.svg';

export const TokensStackName = 'Tokens';

const Tokens: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof TokensStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [, setTransaction] = useAtom(transactionAtom);
  const handleTabChange = (index: number) => {
    navigation.setOptions({ headerTitle: index === 0 ? 'Tokens' : 'NFTs' });
    setTabIndex(index);
  };

  const handleSelectToken = (token: AccountTokenListItem) => {
    setTransaction((v) => ({
      ...v,
      tokenType: token.type,
      balance: token.amount,
      symbol: token.symbol,
      decimals: token.decimals,
      contract: token.contract,
      iconUrl: token.iconUrl,
      priceInUSDT: token.priceInUSDT,
    }));
    navigation.navigate(SendToStackName);
  };

  const handleSelectNFT = (token: AccountTokenListItem & NFTItemDetail & { contractName: string; nftName: string }) => {
    setTransaction((v) => ({
      ...v,
      tokenType: token.type,
      contract: token.contract,
      tokenId: token.tokenId,
      tokenImage: token.image,
      contractName: token.contractName,
      nftName: token.nftName,
      iconUrl: token.iconUrl,
    }));
    navigation.navigate(TransactionConfirmStackName);
  };

  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <View className="px-6">
        <Tab value={tabIndex} onChange={handleTabChange} indicatorStyle={{ backgroundColor: theme.colors.surfaceBrand }}>
          <Tab.Item title="Tokens" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
          <Tab.Item title="NFTs" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
        </Tab>
      </View>

      <TabView value={tabIndex} onChange={handleTabChange} animationType="spring">
        <TabView.Item className="w-full">
          <TokenList onPress={handleSelectToken} />
        </TabView.Item>
        <TabView.Item className="w-full">
          <NFTList onPress={handleSelectNFT} />
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Tokens;
