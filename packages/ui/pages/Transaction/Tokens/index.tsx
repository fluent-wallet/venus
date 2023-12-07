import { useState } from 'react';
import { SafeAreaView, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useTheme, Tab, TabView } from '@rneui/themed';
import { type RootStackList, type StackNavigation, TransactionConfirmStackName, SendToStackName, TokensStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { AccountTokenListItem, NFTItemDetail } from '@hooks/useTokenList';
import NFTList from '@components/NFTList';
import TokenList from '@components/TokenList';
import { AssetType } from '@core/database/models/Asset';
import { transactionAtom } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { NFTItemPressArgs } from '@components/NFTList/NFTItem';

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
      assetType: token.type,
      balance: token.balance,
      symbol: token.symbol,
      decimals: token.decimals,
      contract: token.contract,
      iconUrl: token.iconUrl,
      priceInUSDT: token.priceInUSDT,
    }));
    navigation.navigate(SendToStackName);
  };

  const handleSelectNFT = (NFT: NFTItemPressArgs) => {
    setTransaction((v) => ({
      ...v,
      assetType: NFT.assetType,
      symbol: NFT.symbol,
      balance: NFT.balance,
      contract: NFT.contract,
      tokenId: NFT.tokenId,
      tokenImage: NFT.tokenImage,
      contractName: NFT.contractName,
      nftName: NFT.nftName,
      iconUrl: NFT.iconUrl,
    }));
    if (NFT.assetType === AssetType.ERC1155 && Number(NFT.balance || 0) > 1) {
      navigation.navigate(SendToStackName);
    } else {
      navigation.navigate(TransactionConfirmStackName);
    }
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
          <TokenList onPress={handleSelectToken} skeleton={7} />
        </TabView.Item>
        <TabView.Item className="w-full">
          <NFTList onPress={handleSelectNFT} />
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Tokens;
