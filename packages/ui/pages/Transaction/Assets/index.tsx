import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { RouteProp } from '@react-navigation/native';
import { useAtom } from 'jotai';
import { useTheme, Text } from '@rneui/themed';
import { type RootStackList, type StackNavigation, TransactionConfirmStackName, SendToStackName, TokensStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import ESpaceNFTList from '@modules/AssetList/ESpaceNFTList';
import TokenList from '@modules/AssetList/TokenList';
import { AssetType } from '@core/database/models/Asset';
import { setNFTTransaction, setTokenTransaction } from '@core/WalletCore/Plugins/ReactInject/data/useTransaction';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { NFTWithDetail } from '@modules/AssetList/ESpaceNFTList/fetch';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';

const Assets: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof TokensStackName> }> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const currentNetwork = useCurrentNetwork();

  const [, set20TokenTransaction] = useAtom(setTokenTransaction);
  const [, setSendNFTTransaction] = useAtom(setNFTTransaction);
  const [tabIndex, setTabIndex] = useState(0);
  const tabRef = useRef<PagerView>(null);

  const handleTabChange = (index: number) => {
    navigation.setOptions({ headerTitle: index === 0 ? 'Tokens' : 'NFTs' });
    if (tabRef.current) {
      tabRef.current.setPage(index);
      setTabIndex(index);
    }
  };
  const handlePageSelected = (index: number) => {
    if (index !== tabIndex) {
      setTabIndex(index);
    }
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
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <View className="flex flex-row px-6 gap-4" style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7 }}>
        <Pressable testID="tokens" onPress={() => handleTabChange(0)}>
          <Text
            className="leading-snug p-2"
            style={{
              color: tabIndex === 0 ? theme.colors.surfaceBrand : theme.colors.textSecondary,
              borderBottomWidth: 1,
              borderBottomColor: tabIndex === 0 ? theme.colors.surfaceBrand : 'transparent',
            }}
          >
            Tokens
          </Text>
        </Pressable>

        {currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID) && (
          <Pressable testID="NFTs" onPress={() => handleTabChange(1)}>
            <Text
              className="leading-snug p-2"
              style={{
                color: tabIndex === 1 ? theme.colors.surfaceBrand : theme.colors.textSecondary,
                borderBottomWidth: 1,
                borderBottomColor: tabIndex === 1 ? theme.colors.surfaceBrand : 'transparent',
              }}
            >
              NFTs
            </Text>
          </Pressable>
        )}
      </View>

      <PagerView initialPage={tabIndex} ref={tabRef} onPageSelected={(e) => handlePageSelected(e.nativeEvent.position)}>
        <View className="w-full h-full" key="0">
          <TokenList onPress={handleSelectToken} skeleton={7} />
        </View>
        <View className="w-full h-full pb-2" key="1">
          <ESpaceNFTList onSelectNftItem={handleSelectNFTItem} />
        </View>
      </PagerView>
    </SafeAreaView>
  );
};

export default Assets;
