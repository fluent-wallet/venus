import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';
import AccountSelector from '@modules/AccountSelector';
import { type TabType, Tabs, TabsContent } from '@modules/AssetsTabs';
import NetworkSelector from '@modules/NetworkSelector';
import { useTheme } from '@react-navigation/native';
import { TransactionDetailStackName, type HomeStackName, type StackScreenProps } from '@router/configs';
import { ESPACE_NETWORK_SWITCH_FEATURE, FULL_NETWORK_SWITCH_LIST_FEATURE } from '@utils/features';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { type NativeScrollEvent, StyleSheet, View } from 'react-native';
import type PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import Account from './Account';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import DAPPConnect from './DAPPConnect';
import HeaderRight from './HeaderRight';
import Navigations from './Navigations';
import NoNetworkTip from './NoNetworkTip';
import NotBackup from './NotBackup';
import RefreshScrollView from './RefreshScrollView';
import { Tx } from '@core/database/models/Tx';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { useSharedValue } from 'react-native-reanimated';

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<TabType>('Tokens');
  const pageViewRef = useRef<PagerView>(null);

  const sharedScrollY = useSharedValue(0);

  const handleScroll = useCallback(
    (evt: NativeScrollEvent) => {
      sharedScrollY.set(evt.contentOffset.y);
    },
    [sharedScrollY.set],
  );

  const handleRefresh = useCallback((closeRefresh: VoidFunction) => {
    plugins.NFTDetailTracker.updateCurrentOpenNFT();
    plugins.AssetsTracker.updateCurrentTracker().finally(() => closeRefresh());
  }, []);

  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);

  const handleTxPress = useCallback(
    (data: Tx | AssetInfo) => {
      if (data instanceof Tx) {
        // press activity item
        navigation.navigate(TransactionDetailStackName, { txId: data.id });
      }
    },
    [navigation.navigate],
  );
  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.header}>
          <Account showAccountSelector={showAccountSelector} onPress={() => setShowAccountSelector(true)} navigation={navigation} />
          <HeaderRight
            navigation={navigation}
            onPressNetwork={() => {
              if (FULL_NETWORK_SWITCH_LIST_FEATURE.allow) {
                setShowNetworkSelector(true);
              } else if (ESPACE_NETWORK_SWITCH_FEATURE.allow) {
                const currentNetwork = getCurrentNetwork();
                methods.switchToNetwork(currentNetwork?.netId === 1030 ? 71 : 1030);
              }
            }}
          />
        </View>
        <DAPPConnect />
        <RefreshScrollView stickyHeaderIndices={[4]} onRefresh={handleRefresh} onScroll={currentTab === 'NFTs' ? handleScroll : undefined}>
          <CurrentAddress />
          <TotalPrice />
          <Navigations navigation={navigation} />
          <NotBackup navigation={navigation} />
          <Tabs currentTab={currentTab} pageViewRef={pageViewRef} type="Home" sharedScrollY={sharedScrollY} />
          <TabsContent
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            pageViewRef={pageViewRef}
            type="Home"
            selectType="Home"
            onPressItem={handleTxPress}
          />
        </RefreshScrollView>
        <NoNetworkTip />
      </SafeAreaView>
      {showAccountSelector && <AccountSelector onClose={() => setShowAccountSelector(false)} />}
      {showNetworkSelector && <NetworkSelector onClose={() => setShowNetworkSelector(false)} />}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
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
