import React, { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import Text from '@components/Text';
import TokensList from '@modules/AssetsList/TokensList';

type Tab = 'Tokens' | 'NFTs' | 'Activity';
type Tabs = Array<Tab>;
const TAB_WIDTH = 64;

interface Props {
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  pageViewRef: React.RefObject<PagerView>;
}

export const Tabs: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef }) => {
  const { colors } = useTheme();

  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(
    () =>
      currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
        ? (['Tokens', 'NFTs', 'Activity'] as Tabs)
        : (['Tokens', 'Activity'] as Tabs),
    [currentNetwork],
  );
  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab as 'Tokens');
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  const handleClickTabLabel = useCallback(
    (tab: Tab) => {
      let index = tabs.indexOf(tab);
      index = index === -1 ? 0 : index;
      pageViewRef?.current?.setPage(index);
    },
    [tabs],
  );

  const offset = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  useEffect(() => {
    offset.value = withTiming(TAB_WIDTH * currentTabIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTabIndex]);

  return (
    <>
      <View style={[styles.tabsSelector, { backgroundColor: colors.bgPrimary }]}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => handleClickTabLabel(tab)}>
            <Text
              style={[styles.tabLabel, { color: colors[currentTab === tab ? 'textPrimary' : 'textSecondary'], fontWeight: currentTab === tab ? '600' : '300' }]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
        <Animated.View style={[styles.animatedBorder, animatedStyles, { backgroundColor: colors.borderPrimary }]} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.borderThird }]} />
    </>
  );
};

export const TabsContent: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef }) => {
  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(
    () =>
      currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
        ? (['Tokens', 'NFTs', 'Activity'] as Tabs)
        : (['Tokens', 'Activity'] as Tabs),
    [currentNetwork],
  );
  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab as 'Tokens');
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  return (
    <PagerView ref={pageViewRef} style={styles.pagerView} initialPage={0} onPageSelected={(evt) => setCurrentTab(tabs[evt.nativeEvent.position])}>
      {tabs?.map((tab, index) => (
        <Fragment key={tab}>
          {tab === 'Tokens' && index === currentTabIndex && <TokensList showReceiveFunds />}
          {tab === 'NFTs' && index === currentTabIndex && <Text>Nfts</Text>}
          {tab === 'Activity' && index === currentTabIndex && <Text>Activity</Text>}
        </Fragment>
      ))}
    </PagerView>
  );
};

const styles = StyleSheet.create({
  tabsSelector: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    height: 28,
    paddingHorizontal: 16,
  },
  tabLabel: {
    width: TAB_WIDTH,
    lineHeight: 18,
    fontSize: 14,
    textAlign: 'center',
  },
  animatedBorder: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    width: TAB_WIDTH,
    height: 2,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  divider: {
    height: 1,
  },
  pagerView: {
    flex: 1,
  },
});
