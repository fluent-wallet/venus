import { TabsHeader } from '@modules/AssetsTabs';
import { useTabs } from '@modules/AssetsTabs/hooks';
import type { TabType } from '@modules/AssetsTabs/types';
import { useTheme } from '@react-navigation/native';
import type { HomeStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { TabView } from 'react-native-tab-view';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import { HomeActivityTab } from './HomeActivityTab';
import { HomeNftsTab } from './HomeNftsTab';
import { HomePullToRefresh } from './HomePullToRefresh';
import { HomeTokensTab } from './HomeTokensTab';
import Navigations from './Navigations';
import NotBackup from './NotBackup';
import { useHomeScrollCoordinator } from './useHomeScrollCoordinator';

interface HomeTabRoute {
  key: TabType;
}

export const HomeTabsPager: React.FC<{
  currentTab: TabType;
  sharedScrollY: SharedValue<number>;
  navigation: StackScreenProps<typeof HomeStackName>['navigation'];
  onRefresh: () => Promise<void>;
  onTabChange: (tab: TabType) => void;
  onPressTx: (txId: string) => void;
}> = ({ currentTab, sharedScrollY, navigation, onRefresh, onTabChange, onPressTx }) => {
  const { colors } = useTheme();
  const tabs = useTabs('Home');
  const { width } = useWindowDimensions();
  const tokensScrollGesture = useMemo(() => Gesture.Native(), []);
  const nftsScrollGesture = useMemo(() => Gesture.Native(), []);
  const activityScrollGesture = useMemo(() => Gesture.Native(), []);
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const [tabsHeaderHeight, setTabsHeaderHeight] = useState(0);
  const { activityListRef, activityScrollOffset, nftsListRef, nftsScrollOffset, tokensListRef, tokensScrollOffset, updateTabMetrics } =
    useHomeScrollCoordinator({
      collapseDistance: topSectionHeight,
      currentTab,
      sharedScrollY,
    });

  const topInset = topSectionHeight + tabsHeaderHeight;
  const routes = useMemo<HomeTabRoute[]>(() => tabs.map((tab) => ({ key: tab })), [tabs]);
  const currentIndex = useMemo(() => {
    const index = tabs.indexOf(currentTab);
    return index === -1 ? 0 : index;
  }, [currentTab, tabs]);

  useEffect(() => {
    const fallbackTab = tabs[0];
    if (fallbackTab && !tabs.includes(currentTab)) {
      onTabChange(fallbackTab);
    }
  }, [currentTab, onTabChange, tabs]);

  const handleTopSectionLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setTopSectionHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const handleTabsHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setTabsHeaderHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const topSectionAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(sharedScrollY.value, topSectionHeight) }],
  }));

  const tabsHeaderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(sharedScrollY.value, topSectionHeight) }],
  }));

  const renderTabPage = useCallback(
    (route: HomeTabRoute) => {
      switch (route.key) {
        case 'Tokens':
          return (
            <HomeTokensTab
              flatListRef={tokensListRef}
              topInset={topInset}
              onLayoutHeightChange={(height) => updateTabMetrics('Tokens', { layoutHeight: height })}
              onContentHeightChange={(height) => updateTabMetrics('Tokens', { contentHeight: height })}
              scrollOffset={tokensScrollOffset}
              sharedScrollY={sharedScrollY}
              isActive={currentTab === route.key}
              scrollGesture={tokensScrollGesture}
            />
          );
        case 'NFTs':
          return (
            <HomeNftsTab
              flatListRef={nftsListRef}
              topInset={topInset}
              onLayoutHeightChange={(height) => updateTabMetrics('NFTs', { layoutHeight: height })}
              onContentHeightChange={(height) => updateTabMetrics('NFTs', { contentHeight: height })}
              scrollOffset={nftsScrollOffset}
              sharedScrollY={sharedScrollY}
              isActive={currentTab === route.key}
              scrollGesture={nftsScrollGesture}
            />
          );
        case 'Activity':
          return (
            <HomeActivityTab
              flatListRef={activityListRef}
              onPressTx={onPressTx}
              topInset={topInset}
              onLayoutHeightChange={(height) => updateTabMetrics('Activity', { layoutHeight: height })}
              onContentHeightChange={(height) => updateTabMetrics('Activity', { contentHeight: height })}
              scrollOffset={activityScrollOffset}
              sharedScrollY={sharedScrollY}
              isActive={currentTab === route.key}
              scrollGesture={activityScrollGesture}
            />
          );
      }
    },
    [
      activityListRef,
      activityScrollGesture,
      activityScrollOffset,
      currentTab,
      nftsListRef,
      nftsScrollGesture,
      nftsScrollOffset,
      onPressTx,
      sharedScrollY,
      tokensListRef,
      tokensScrollGesture,
      tokensScrollOffset,
      topInset,
      updateTabMetrics,
    ],
  );
  const handleIndexChange = useCallback(
    (index: number) => {
      const nextTab = tabs[index];
      if (nextTab && nextTab !== currentTab) {
        onTabChange(nextTab);
      }
    },
    [currentTab, onTabChange, tabs],
  );

  const activeScrollGesture = useMemo(() => {
    switch (currentTab) {
      case 'Tokens':
        return tokensScrollGesture;
      case 'NFTs':
        return nftsScrollGesture;
      case 'Activity':
        return activityScrollGesture;
    }
  }, [activityScrollGesture, currentTab, nftsScrollGesture, tokensScrollGesture]);

  return (
    <HomePullToRefresh scrollY={sharedScrollY} onRefresh={onRefresh} nativeScrollGestures={[activeScrollGesture]}>
      <View style={styles.container}>
        <View pointerEvents="box-none" style={[styles.topSectionClipLayer, { height: topSectionHeight }]}>
          <Animated.View
            pointerEvents="box-none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[styles.topSectionLayer, topSectionAnimatedStyle, { backgroundColor: colors.bgPrimary }]}
          >
            <View onLayout={handleTopSectionLayout}>
              <CurrentAddress />
              <TotalPrice />
              <Navigations navigation={navigation} />
              <NotBackup navigation={navigation} />
            </View>
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents="box-none"
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={[styles.tabsHeaderLayer, tabsHeaderAnimatedStyle, { top: topSectionHeight, backgroundColor: colors.bgPrimary }]}
        >
          <View onLayout={handleTabsHeaderLayout}>
            <TabsHeader type="Home" currentTab={currentTab} sharedScrollY={sharedScrollY} onTabChange={onTabChange} nftStickyStartY={topSectionHeight} />
          </View>
        </Animated.View>

        <TabView
          navigationState={{ index: currentIndex, routes }}
          onIndexChange={handleIndexChange}
          renderScene={({ route }) => renderTabPage(route)}
          renderTabBar={() => null}
          initialLayout={{ width }}
          lazy={false}
          overScrollMode="never"
          style={styles.pagerView}
        />
      </View>
    </HomePullToRefresh>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
  topSectionClipLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: 'hidden',
  },
  topSectionLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  tabsHeaderLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'visible',
  },
  pagerView: {
    flex: 1,
  },
});
