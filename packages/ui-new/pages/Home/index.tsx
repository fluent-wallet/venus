import AccountSelector from '@modules/AccountSelector';
import { useTabsController } from '@modules/AssetsTabs/hooks';
import NetworkSelector from '@modules/NetworkSelector';
import { useTheme } from '@react-navigation/native';
import { type HomeStackName, type StackScreenProps, TransactionDetailStackName } from '@router/configs';
import { useCurrentNetwork, useNetworks, useSwitchNetwork } from '@service/network';
import { ESPACE_NETWORK_SWITCH_FEATURE, FULL_NETWORK_SWITCH_LIST_FEATURE } from '@utils/features';
import type React from 'react';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Account from './Account';
import DAPPConnect from './DAPPConnect';
import HeaderRight from './HeaderRight';
import { HomeTabsPager } from './HomeTabsPager';
import NoNetworkTip from './NoNetworkTip';
import { useHomeRefresh } from './useHomeRefresh';

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const { currentTab, setCurrentTab, sharedScrollY } = useTabsController('Tokens');
  const { data: currentNetwork } = useCurrentNetwork();
  const { data: networks = [] } = useNetworks();
  const switchNetwork = useSwitchNetwork();
  const handleRefresh = useHomeRefresh();

  const handleTxPress = useCallback(
    (txId: string) => {
      navigation.navigate(TransactionDetailStackName, { txId });
    },
    [navigation],
  );

  const handleOpenAccountSelector = () => {
    setShowAccountSelector(true);
  };

  const handleOpenNetworkSelector = () => {
    // setShowNetworkSelector(true);

    if (FULL_NETWORK_SWITCH_LIST_FEATURE.allow) {
      setShowNetworkSelector(true);
    } else if (ESPACE_NETWORK_SWITCH_FEATURE.allow) {
      if (!currentNetwork) return;
      const nextNetId = currentNetwork.netId === 1030 ? 71 : 1030;
      const target =
        networks.find((network) => network.netId === nextNetId && network.networkType === currentNetwork.networkType) ??
        networks.find((network) => network.netId === nextNetId);
      if (!target) return;
      switchNetwork(target.id).catch(() => undefined);
    }
  };
  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.header}>
          <Account showAccountSelector={showAccountSelector} onPress={handleOpenAccountSelector} navigation={navigation} />
          <HeaderRight navigation={navigation} onPressNetwork={handleOpenNetworkSelector} />
        </View>
        <DAPPConnect />
        <HomeTabsPager
          currentTab={currentTab}
          sharedScrollY={sharedScrollY}
          navigation={navigation}
          onRefresh={handleRefresh}
          onTabChange={setCurrentTab}
          onPressTx={handleTxPress}
        />
        <NoNetworkTip />
      </SafeAreaView>
      {showAccountSelector && <AccountSelector isOpen={showAccountSelector} onClose={() => setShowAccountSelector(false)} />}
      {showNetworkSelector && <NetworkSelector isOpen={showNetworkSelector} onClose={() => setShowNetworkSelector(false)} />}
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
