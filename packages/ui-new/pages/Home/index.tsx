import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import plugins from '@core/WalletCore/Plugins';
import methods from '@core/WalletCore/Methods';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';
import { HomeStackName, type StackScreenProps } from '@router/configs';
import { isProd } from '@utils/getEnv';
import Account from './Account';
import AccountSelector, { type BottomSheetMethods } from './AccountSelector';
import NetworkSelector from './NetworkSelector';
import HeaderRight from './HeaderRight';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import Navigations from './Navigations';
import { Tabs, TabsContent, setScrollY } from './Tabs';
import NotBackup from './NotBackup';
import RefreshScrollView from './RefreshScrollView';

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  const accountSelectorRef = useRef<BottomSheetMethods>(null!);
  const networkSelectorRef = useRef<BottomSheetMethods>(null!);

  const [currentTab, setCurrentTab] = useState<'Tokens' | 'NFTs' | 'Activity'>('Tokens');
  const pageViewRef = useRef<PagerView>(null);

  const handleScroll = useCallback((evt: NativeScrollEvent) => {
    setScrollY(evt.contentOffset.y);
  }, []);

  useEffect(() => {
    setScrollY(0);
  }, [currentTab]);

  const handleRefresh = useCallback((closeRefresh: VoidFunction) => {
    plugins.NFTDetailTracker.updateCurrentOpenNFT();
    plugins.AssetsTracker.updateCurrentTracker().finally(() => closeRefresh());
  }, []);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Account onPress={() => accountSelectorRef.current?.expand()} navigation={navigation} />
          <HeaderRight
            navigation={navigation}
            onPressNetwork={() => {
              if (isProd) {
                const currentNetwork = getCurrentNetwork();
                methods.switchToNetwork(currentNetwork?.netId === 1030 ? 71 : 1030);
              } else {
                networkSelectorRef.current?.expand();
              }
            }}
          />
        </View>
        <RefreshScrollView stickyHeaderIndices={[4]} onRefresh={handleRefresh} onScroll={currentTab === 'NFTs' ? handleScroll : undefined}>
          <CurrentAddress />
          <TotalPrice />
          <Navigations />
          <NotBackup navigation={navigation} />
          <Tabs currentTab={currentTab} pageViewRef={pageViewRef} />
          <TabsContent currentTab={currentTab} setCurrentTab={setCurrentTab} pageViewRef={pageViewRef} />
        </RefreshScrollView>
      </SafeAreaView>
      <AccountSelector selectorRef={accountSelectorRef} />
      <NetworkSelector selectorRef={networkSelectorRef} />
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
