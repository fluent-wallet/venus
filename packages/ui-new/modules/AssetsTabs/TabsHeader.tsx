import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated as NativeAnimated, Pressable, StyleSheet, View } from 'react-native';

import { useTabs } from './hooks';
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
  pagerPosition: NativeAnimated.AnimatedInterpolation<number>;
  onTabChange: (tab: TabType) => void;
}

export const TabsHeader: React.FC<TabsHeaderProps> = ({ type, currentTab, onlyToken, pagerPosition, onTabChange }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const tabs = useTabs(type, onlyToken);

  // Follow page progress without waiting for the selected tab to change.
  const pagerOffset = useMemo(() => NativeAnimated.multiply(pagerPosition, TAB_WIDTH), [pagerPosition]);

  return (
    <>
      <View style={[styles.tabsSelector, { backgroundColor: type !== 'Home' ? colors.bgFourth : colors.bgPrimary }]}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => onTabChange(tab)}>
            <Text
              style={[styles.tabLabel, { color: colors[currentTab === tab ? 'textPrimary' : 'textSecondary'], fontWeight: currentTab === tab ? '600' : '300' }]}
            >
              {t(TabI18nMap[tab])}
            </Text>
          </Pressable>
        ))}
        <NativeAnimated.View style={[styles.animatedBorder, { backgroundColor: colors.borderPrimary, transform: [{ translateX: pagerOffset }] }]} />
      </View>
      <View style={[styles.divider, { backgroundColor: type !== 'Home' ? colors.borderFourth : colors.borderThird }]} />
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
});
