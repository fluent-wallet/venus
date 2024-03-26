import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, type NativeScrollEvent, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import { useTheme } from '@react-navigation/native';
import plugins from '@core/WalletCore/Plugins';
import methods from '@core/WalletCore/Methods';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';
import { HomeStackName, type StackScreenProps } from '@router/configs';
import { isProd } from '@utils/getEnv';
import { Tabs, TabsContent, setHomeScrollY, type Tab } from '@modules/AssetsTabs';
import AccountSelector from '@modules/AccountSelector';
import NetworkSelector from '@modules/NetworkSelector';
import Account from './Account';
import HeaderRight from './HeaderRight';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import Navigations from './Navigations';
import NotBackup from './NotBackup';
import RefreshScrollView from './RefreshScrollView';
import { SWITCH_NETWORK_DRAWER_FEATURE } from '@utils/features';

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<Tab>('Tokens');
  const pageViewRef = useRef<PagerView>(null);

  const handleScroll = useCallback((evt: NativeScrollEvent) => {
    setHomeScrollY(evt.contentOffset.y);
  }, []);

  const handleRefresh = useCallback((closeRefresh: VoidFunction) => {
    plugins.NFTDetailTracker.updateCurrentOpenNFT();
    plugins.AssetsTracker.updateCurrentTracker().finally(() => closeRefresh());
  }, []);

  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.header}>
          <Account onPress={() => setShowAccountSelector(true)} navigation={navigation} />
          <HeaderRight
            navigation={navigation}
            onPressNetwork={() => {
              if (SWITCH_NETWORK_DRAWER_FEATURE) {
                const currentNetwork = getCurrentNetwork();
                methods.switchToNetwork(currentNetwork?.netId === 1030 ? 71 : 1030);
              } else {
                setShowNetworkSelector(true);
              }
            }}
          />
        </View>
        <RefreshScrollView stickyHeaderIndices={[4]} onRefresh={handleRefresh} onScroll={currentTab === 'NFTs' ? handleScroll : undefined}>
          <CurrentAddress />
          <TotalPrice />
          <Navigations navigation={navigation} />
          <NotBackup navigation={navigation} />
          <Tabs currentTab={currentTab} pageViewRef={pageViewRef} type="Home" />
          <TabsContent currentTab={currentTab} setCurrentTab={setCurrentTab} pageViewRef={pageViewRef} type="Home" />
        </RefreshScrollView>
      </SafeAreaView>
      {showAccountSelector && <AccountSelector onClose={() => setShowAccountSelector(false)} />}
      {showNetworkSelector && <NetworkSelector onClose={() => setShowNetworkSelector(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 16,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  walletLinkContainer: {
    marginTop: 32,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  walletLink: {
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  walletLinkText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
});

export default Home;
