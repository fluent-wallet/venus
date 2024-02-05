import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import { screenWidth } from '@utils/deviceInfo';
import Text from '@components/Text';

type Tab = 'Tokens' | 'NFTs' | 'Activity';
type Tabs = Array<Tab>;
const TAB_WIDTH = 64;

const TabsSelector: React.FC<{
  tabs: Tabs;
  currentTabIndex: number;
  currentTab: Tab;
  handleClickTabLabel: (tab: Tab) => void;
}> = ({ tabs, currentTabIndex, currentTab, handleClickTabLabel }) => {
  const { colors } = useTheme();

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
      <View style={styles.tabsSelector}>
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

const Tabs: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'Tokens' | 'NFTs' | 'Activity'>('Tokens');
  const currentNetwork = useCurrentNetwork();

  const pageViewRef = useRef<PagerView>(null);

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
      pageViewRef.current?.setPage(index);
    },
    [tabs],
  );

  return (
    <>
      <TabsSelector tabs={tabs} currentTabIndex={currentTabIndex} currentTab={currentTab} handleClickTabLabel={handleClickTabLabel} />
      <PagerView ref={pageViewRef} style={{ flex: 1 }} initialPage={0} onPageSelected={(evt) => setCurrentTab(tabs[evt.nativeEvent.position])}>
        {tabs?.map((tab, index) => (
          <View style={{ backgroundColor: 'red' }} key={index}>
            {tab === 'Tokens' && index === currentTabIndex && (
              <View>
                <Text>Tokens</Text>
              </View>
            )}
            {tab === 'NFTs' && index === currentTabIndex && (
              <View>
                <Text>Nfts</Text>
              </View>
            )}
            {tab === 'Activity' && index === currentTabIndex && (
              <View>
                <Text>Activity</Text>
              </View>
            )}
          </View>
        ))}
      </PagerView>
    </>
  );
};

const styles = StyleSheet.create({
  tabsSelector: {
    marginTop: 24,
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    height: 28,
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
    left: 0,
    width: TAB_WIDTH,
    height: 2,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  divider: {
    width: screenWidth,
    height: 1,
    transform: [{ translateX: -16 }],
  },
});

export default Tabs;
