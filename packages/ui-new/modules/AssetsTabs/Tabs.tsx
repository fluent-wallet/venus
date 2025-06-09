import Text from '@components/Text';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';

import { Networks } from '@core/utils/consts';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import Animated, { useSharedValue, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Props, TabsArrayType, TabType } from './types';
import { StickyNFT } from './StickyNFT';

const TabI18nMap = {
  Tokens: 'tab.tokens' as const,
  NFTs: 'tab.nfts' as const,
  Activity: 'tab.activity' as const,
};
const TAB_WIDTH = 64;

export const Tabs: React.FC<Omit<Props, 'setCurrentTab' | 'onPressItem' | 'selectType'> & { sharedScrollY: SharedValue<number> }> = ({
  type,
  currentTab,
  pageViewRef,
  onlyToken,
  sharedScrollY,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(() => {
    const res =
      !onlyToken &&
      (!currentNetwork ||
        (currentNetwork && (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId)))
        ? (['Tokens', 'NFTs'] as TabsArrayType)
        : (['Tokens'] as TabsArrayType);
    type === 'Home' && res.push('Activity');
    return res;
  }, [currentNetwork, type]);

  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab as 'Tokens');
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  const handleClickTabLabel = useCallback(
    (tab: TabType) => {
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
    offset.set(() => withTiming(TAB_WIDTH * currentTabIndex));
  }, [currentTabIndex, offset.set]);

  useEffect(() => {
    sharedScrollY?.set(0);
  }, [currentTab, sharedScrollY?.set]);

  useEffect(() => {
    return () => {
      sharedScrollY?.set(0);
    };
  }, [sharedScrollY?.set]);

  return (
    <>
      <View style={[styles.tabsSelector, { backgroundColor: type !== 'Home' ? colors.bgFourth : colors.bgPrimary }]}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => handleClickTabLabel(tab)}>
            <Text
              style={[styles.tabLabel, { color: colors[currentTab === tab ? 'textPrimary' : 'textSecondary'], fontWeight: currentTab === tab ? '600' : '300' }]}
            >
              {t(TabI18nMap[tab])}
            </Text>
          </Pressable>
        ))}
        <Animated.View style={[styles.animatedBorder, animatedStyles, { backgroundColor: colors.borderPrimary }]} />
      </View>
      <View style={[styles.divider, { backgroundColor: type !== 'Home' ? colors.borderFourth : colors.borderThird }]}>
        {currentTab === 'NFTs' && <StickyNFT sharedScrollY={sharedScrollY} type={type} />}
      </View>
    </>
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
