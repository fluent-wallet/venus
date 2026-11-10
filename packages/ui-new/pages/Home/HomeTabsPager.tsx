import { TabsHeader } from '@modules/AssetsTabs';
import { useTabs } from '@modules/AssetsTabs/hooks';
import type { TabType } from '@modules/AssetsTabs/types';
import { useTheme } from '@react-navigation/native';
import type { HomeStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { type SceneRendererProps, TabView } from 'react-native-tab-view';
import { CurrentAddress, TotalPrice } from './Address&TotalPrice';
import { HomeActivityTab } from './HomeActivityTab';
import { HomeNftsTab } from './HomeNftsTab';
import { HomePullToRefresh } from './HomePullToRefresh';
import { HomeTokensTab } from './HomeTokensTab';
import Navigations from './Navigations';
import NotBackup from './NotBackup';
import { useHomeScrollCoordinator } from './useHomeScrollCoordinator';
import { useHomeTabScroll } from './useHomeTabScroll';

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
  const [topSectionHeight, setTopSectionHeight] = useState(0);
  const [tabsHeaderHeight, setTabsHeaderHeight] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const coordinator = useHomeScrollCoordinator({ collapseDistance: topSectionHeight, currentTab, sharedScrollY });
  const tokensScroll = useHomeTabScroll('Tokens', coordinator);
  const nftsScroll = useHomeTabScroll('NFTs', coordinator);
  const activityScroll = useHomeTabScroll('Activity', coordinator);
  const scrollBindings = useMemo(() => ({ Tokens: tokensScroll, NFTs: nftsScroll, Activity: activityScroll }), [tokensScroll, nftsScroll, activityScroll]);

  const topInset = topSectionHeight + tabsHeaderHeight;
  // Short pages need enough scroll range to keep the header collapsed.
  const minimumContentHeight = pagerHeight + topSectionHeight;
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
  const handlePagerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setPagerHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(sharedScrollY.value, topSectionHeight) }],
  }));

  const renderTabPage = useCallback(
    ({ route }: { route: HomeTabRoute }) => {
      switch (route.key) {
        case 'Tokens':
          return <HomeTokensTab scroll={tokensScroll} topInset={topInset} minimumContentHeight={minimumContentHeight} />;
        case 'NFTs':
          return (
            <HomeNftsTab
              scroll={nftsScroll}
              topInset={topInset}
              minimumContentHeight={minimumContentHeight}
              stickyHeaderOffset={tabsHeaderHeight}
              isActive={currentTab === 'NFTs'}
            />
          );
        case 'Activity':
          return <HomeActivityTab scroll={activityScroll} onPressTx={onPressTx} topInset={topInset} minimumContentHeight={minimumContentHeight} />;
      }
    },
    [activityScroll, currentTab, minimumContentHeight, nftsScroll, onPressTx, tabsHeaderHeight, tokensScroll, topInset],
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
  const renderTabBar = useCallback(
    ({ position }: SceneRendererProps) => (
      <Animated.View
        pointerEvents="box-none"
        shouldRasterizeIOS
        style={[styles.tabsHeaderLayer, headerAnimatedStyle, { top: topSectionHeight, backgroundColor: colors.bgPrimary }]}
      >
        <View onLayout={handleTabsHeaderLayout}>
          <TabsHeader type="Home" currentTab={currentTab} pagerPosition={position} onTabChange={onTabChange} />
        </View>
      </Animated.View>
    ),
    [colors.bgPrimary, currentTab, handleTabsHeaderLayout, headerAnimatedStyle, onTabChange, topSectionHeight],
  );

  return (
    <HomePullToRefresh scrollY={sharedScrollY} onRefresh={onRefresh} nativeScrollGesture={scrollBindings[currentTab].scrollGesture}>
      <View style={styles.container} onLayout={handlePagerLayout}>
        <View pointerEvents="box-none" style={[styles.topSectionClipLayer, { height: topSectionHeight }]}>
          <Animated.View
            pointerEvents="box-none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
            style={[styles.topSectionLayer, headerAnimatedStyle, { backgroundColor: colors.bgPrimary }]}
          >
            <View onLayout={handleTopSectionLayout}>
              <CurrentAddress />
              <TotalPrice />
              <Navigations navigation={navigation} />
              <NotBackup navigation={navigation} />
            </View>
          </Animated.View>
        </View>

        <TabView
          navigationState={{ index: currentIndex, routes }}
          onIndexChange={handleIndexChange}
          renderScene={renderTabPage}
          renderTabBar={renderTabBar}
          initialLayout={{ width }}
          lazy={false}
          overScrollMode="never"
          offscreenPageLimit={Math.max(routes.length - 1, 1)}
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
