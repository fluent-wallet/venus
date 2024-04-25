/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useEffect, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import Text from '@components/Text';
import AccountsList from '@modules/AccountsList';
import RecentlyList from './RecentlyList';

export enum Tab {
  Recently = 'Recently',
  Contacts = 'Contacts',
  MyWallets = 'My Wallets',
}
const TAB_WIDTH = 94;

interface Props {
  currentTab: Tab;
  pageViewRef: React.RefObject<PagerView>;
  setCurrentTab: (tab: Tab) => void;
  onPressReceiver: (receiver: string) => void;
}

const tabs = [Tab.Recently, Tab.MyWallets];

export const Tabs: React.FC<Omit<Props, 'setCurrentTab' | 'onPressReceiver'>> = ({ currentTab, pageViewRef }) => {
  const { colors } = useTheme();
  const currentNetwork = useCurrentNetwork();

  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab);
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  const handleClickTabLabel = useCallback(
    (tab: Tab) => {
      let index = tabs.indexOf(tab);
      index = index === -1 ? 0 : index;
      pageViewRef?.current?.setPage(index);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabs],
  );

  const offset = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  useEffect(() => {
    offset.value = withTiming(TAB_WIDTH * currentTabIndex);
  }, [currentTabIndex]);

  return (
    <View style={[styles.tabsSelector, { backgroundColor: colors.bgFourth }]}>
      {tabs.map((tab) => (
        <Pressable key={tab} onPress={() => handleClickTabLabel(tab)} testID={tab}>
          <Text
            style={[styles.tabLabel, { color: colors[currentTab === tab ? 'textPrimary' : 'textSecondary'], fontWeight: currentTab === tab ? '600' : '300' }]}
          >
            {tab}
          </Text>
        </Pressable>
      ))}
      <Animated.View style={[styles.animatedBorder, animatedStyles, { backgroundColor: colors.borderPrimary }]} />
    </View>
  );
};

export const TabsContent: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef, onPressReceiver }) => {
  const currentNetwork = useCurrentNetwork();
  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab);
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  return (
    <PagerView ref={pageViewRef} style={styles.pagerView} initialPage={0} onPageSelected={(evt) => setCurrentTab(tabs[evt.nativeEvent.position])}>
      {tabs?.map((tab, index) => (
        <View key={tab}>
          {tab === Tab.MyWallets && index === currentTabIndex && (
            <AccountsList type="selector" onPressAccount={({ addressValue }) => onPressReceiver(addressValue)} />
          )}
          {tab === Tab.Recently && index === currentTabIndex && <RecentlyList onPressAddress={(addressValue) => onPressReceiver(addressValue)} />}
        </View>
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
    position: 'relative',
    height: 1,
  },
  pagerView: {
    flex: 1,
  },
});
