import { useState } from 'react';
import { SafeAreaView, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useTheme, Tab, TabView } from '@rneui/themed';
import { type RootStackList, type StackNavigation, TransactionConfirmStackName, SendToStackName, TokensStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import ESpaceNFTList from '@modules/AssetList/ESpaceNFTList';
import TokenList from '@modules/AssetList/TokenList';
import { AssetType } from '@core/database/models/Asset';
import { setNFTTransaction, setTokenTransaction } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { NFTWithDetail } from '@modules/AssetList/ESpaceNFTList/fetch';

const Assets: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof TokensStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [, set20TokenTransaction] = useAtom(setTokenTransaction);
  const [, setSendNFTTransaction] = useAtom(setNFTTransaction);
  const handleTabChange = (index: number) => {
    navigation.setOptions({ headerTitle: index === 0 ? 'Tokens' : 'NFTs' });
    setTabIndex(index);
  };

  const handleSelectToken = (token: AssetInfo) => {
    set20TokenTransaction({
      assetType: token.type,
      balance: token.balance,
      symbol: token.symbol,
      decimals: token.decimals,
      contractAddress: token.contractAddress,
      iconUrl: token.icon,
      priceInUSDT: token.priceInUSDT,
    });

    navigation.navigate(SendToStackName);
  };

  const handleSelectNFTItem = (nft: NFTWithDetail) => {
    const { type, symbol, decimals, contractAddress, icon, name } = nft;
    const { amount: nftBalance, name: nftName, tokenId: nftTokenId, icon: nftIcon } = nft.detail;
    setSendNFTTransaction({
      assetType: type,
      symbol: symbol,
      balance: nftBalance,
      contractAddress: contractAddress,
      tokenId: nftTokenId,
      tokenImage: nftIcon ?? undefined,
      contractName: name,
      nftName: nftName,
      iconUrl: icon ?? undefined,
      decimals: 0,
    });
    if (nft.type === AssetType.ERC1155 && Number(nftBalance || 0) > 1) {
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
          <Tab.Item testID='tokenTab' title="Tokens" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
          <Tab.Item testID='NFTTab' title="NFTs" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
        </Tab>
      </View>

      <TabView value={tabIndex} onChange={handleTabChange} animationType="spring">
        <TabView.Item className="w-full">
          <TokenList onPress={handleSelectToken} skeleton={7} from="transaction" />
        </TabView.Item>
        <TabView.Item className="w-full">
          <ESpaceNFTList onSelectNftItem={handleSelectNFTItem} />
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default Assets;
