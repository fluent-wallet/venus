import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import Animated, { useSharedValue, useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';
import type { TabsType, TabType } from './types';
import { StickyNFT } from './StickyNFT';
import { useTabs } from './hooks';

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
  onTabChange?: (tab: TabType) => void;
  resetScrollY?: () => void;
}

export const TabsHeader: React.FC<TabsHeaderProps> = ({ type, currentTab, onlyToken, sharedScrollY, onTabChange, resetScrollY }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const tabs = useTabs(type, onlyToken);

  const currentTabIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab as 'Tokens');
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

  const offset = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  useEffect(() => {
    offset.set(() => withTiming(TAB_WIDTH * currentTabIndex));
  }, [currentTabIndex, offset.set]);

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
