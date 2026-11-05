import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated as NativeAnimated, Pressable, StyleSheet, View } from 'react-native';

import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTabs } from './hooks';
import { StickyNFT } from './StickyNFT';
import type { TabsType, TabType } from './types';

const TabI18nMap = {
  Tokens: 'tab.tokens' as const,
  NFTs: 'tab.nfts' as const,
  Activity: 'tab.activity' as const,
};
const TAB_WIDTH = 64;

interface TabsHeaderProps {
  type: TabsType;
  currentTab: TabType;
  onlyToken?: boolean;
  sharedScrollY: SharedValue<number>;
  pagerPosition?: NativeAnimated.AnimatedInterpolation<number>;
  nftStickyStartY?: number;
  onTabChange?: (tab: TabType) => void;
  resetScrollY?: () => void;
}

const SelectedTabIndicator: React.FC<{ tabIndex: number; color: string }> = ({ tabIndex, color }) => {
  const offset = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  useEffect(() => {
    offset.set(() => withTiming(TAB_WIDTH * tabIndex));
  }, [tabIndex, offset]);

  return <Animated.View style={[styles.animatedBorder, animatedStyle, { backgroundColor: color }]} />;
};

export const TabsHeader: React.FC<TabsHeaderProps> = ({
  type,
  currentTab,
  onlyToken,
  sharedScrollY,
  pagerPosition,
  nftStickyStartY,
  onTabChange,
  resetScrollY,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const tabs = useTabs(type, onlyToken);

  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab);
    return index === -1 ? 0 : index;
  }, [tabs, currentTab]);

  const handleClickTabLabel = useCallback(
    (tab: TabType) => {
      if (onTabChange) {
        onTabChange(tab);
      }
    },
    [onTabChange],
  );

  // Follow page progress without waiting for the selected tab to change.
  const pagerOffset = useMemo(() => (pagerPosition ? NativeAnimated.multiply(pagerPosition, TAB_WIDTH) : null), [pagerPosition]);

  useEffect(() => {
    if (resetScrollY) {
      resetScrollY();
    }
  }, [currentTab, resetScrollY]);

  useEffect(() => {
    return () => {
      if (resetScrollY) {
        resetScrollY();
      }
    };
  }, [resetScrollY]);

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
        {pagerOffset ? (
          <NativeAnimated.View style={[styles.animatedBorder, { backgroundColor: colors.borderPrimary, transform: [{ translateX: pagerOffset }] }]} />
        ) : (
          <SelectedTabIndicator tabIndex={currentTabIndex} color={colors.borderPrimary} />
        )}
      </View>
      <View style={[styles.divider, { backgroundColor: type !== 'Home' ? colors.borderFourth : colors.borderThird }]}>
        {currentTab === 'NFTs' && <StickyNFT sharedScrollY={sharedScrollY} type={type} startYOverride={nftStickyStartY} />}
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
