import Text from '@components/Text';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { NetworkType, setAtom, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import type { Tx } from '@core/database/models/Tx';
import { Networks } from '@core/utils/consts';
import ActivityList from '@modules/ActivityList';
import NFTsList from '@modules/AssetsList/NFTsList';
import { StickyNFTItem } from '@modules/AssetsList/NFTsList/NFTItem';
import TokensList from '@modules/AssetsList/TokensList';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';
import { useTheme } from '@react-navigation/native';
import { screenHeight } from '@utils/deviceInfo';
import { atom, useAtomValue } from 'jotai';
/* eslint-disable react-hooks/exhaustive-deps */
import type React from 'react';
import { useCallback, useEffect, useMemo, useState, createRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, findNodeHandle, Platform } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

export type Tab = 'Tokens' | 'NFTs' | 'Activity';
const TabI18nMap = {
  Tokens: 'tab.tokens' as const,
  NFTs: 'tab.nfts' as const,
  Activity: 'tab.activity' as const,
};
export type TabsType = 'Home' | 'SelectAsset';
type Tabs = Array<Tab>;
const TAB_WIDTH = 64;

interface BaseProps {
  type: TabsType;
  currentTab: Tab;
  pageViewRef: React.RefObject<PagerView>;
  setCurrentTab: (tab: Tab) => void;
  onlyToken?: boolean;
}

type Props =
  | (BaseProps & {
      selectType: 'Send' | 'Receive';
      onPressItem?: (v: AssetInfo) => void;
    })
  | (BaseProps & {
      selectType: 'Home';
      onPressItem?: (v: AssetInfo | Tx) => void;
    });

export const Tabs: React.FC<Omit<Props, 'setCurrentTab' | 'onPressItem' | 'selectType'>> = ({ type, currentTab, pageViewRef, onlyToken }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(() => {
    const res =
      !onlyToken &&
      (!currentNetwork ||
        (currentNetwork && (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId)))
        ? (['Tokens', 'NFTs'] as Tabs)
        : (['Tokens'] as Tabs);
    type === 'Home' && res.push('Activity');
    return res;
  }, [currentNetwork, type]);

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
  }, [currentTabIndex]);

  useEffect(() => {
    mapOfSetScrollY[type](0);
  }, [currentTab]);

  useEffect(() => {
    return () => {
      mapOfSetScrollY[type](0);
    };
  }, []);

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
        {currentTab === 'NFTs' && <StickyNFT type={type} />}
      </View>
    </>
  );
};

const createStickyNFTScrollAtom = () => {
  const tabPageViewScrollYAtom = atom(0);
  const setScrollY = (height: number) => setAtom(tabPageViewScrollYAtom, height);
  const useTabPageViewScrollY = () => useAtomValue(tabPageViewScrollYAtom);
  return {
    setScrollY,
    useTabPageViewScrollY,
  };
};
export const { setScrollY: setHomeScrollY, useTabPageViewScrollY: useHomeTabPageViewScrollY } = createStickyNFTScrollAtom();
export const { setScrollY: setSelectAssetScrollY, useTabPageViewScrollY: useSelectAssetTabPageViewScrollY } = createStickyNFTScrollAtom();
const mapOfUseTabPageViewScrollY = {
  Home: useHomeTabPageViewScrollY,
  SelectAsset: useSelectAssetTabPageViewScrollY,
};
const mapOfSetScrollY = {
  Home: setHomeScrollY,
  SelectAsset: setSelectAssetScrollY,
};

export const StickyNFT: React.FC<{ type: TabsType }> = ({ type }) => {
  const shouldShowNotBackup = useShouldShowNotBackup();
  const scrollY = mapOfUseTabPageViewScrollY[type]();
  const startY = useMemo(() => (type === 'Home' ? (shouldShowNotBackup ? 324 : 200) : 1), [type]);
  return <StickyNFTItem scrollY={scrollY} startY={startY} tabsType={type} />;
};

export const TabsContent: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef, type, selectType, onlyToken, onPressItem }) => {
  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(() => {
    const res =
      !onlyToken &&
      (!currentNetwork ||
        (currentNetwork && (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId)))
        ? (['Tokens', 'NFTs'] as Tabs)
        : (['Tokens'] as Tabs);
    type === 'Home' && res.push('Activity');
    return res;
  }, [currentNetwork, type]);
  const shouldShowNotBackup = useShouldShowNotBackup();

  const minHeight = useMemo(() => screenHeight - (selectType === 'Home' ? (shouldShowNotBackup ? 450 : 340) : 300), [shouldShowNotBackup, selectType]);
  const [pageViewHeight, setPageViewHeight] = useState<number | undefined>(() => undefined);
  const parentRefs = useMemo<RefObject<View>[]>(() => Array.from({ length: tabs.length }).map(() => createRef()), [tabs]);
  const childRefs = useMemo<RefObject<View>[]>(() => Array.from({ length: tabs.length }).map(() => createRef()), [tabs]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const recalculateHeight = useCallback(
    (tab: Tab) => {
      const position = tabs.indexOf(tab);
      if (position === -1) return;
      const childNumber = findNodeHandle(parentRefs[position].current);
      if (childNumber === null) return;
      childRefs[position].current?.measureLayout(childNumber, (_, __, ___, height) => {
        setPageViewHeight(Math.max(height, minHeight));
      });
    },
    [tabs],
  );

  return (
    <PagerView
      ref={pageViewRef}
      style={[styles.pagerView, { minHeight, height: pageViewHeight }]}
      initialPage={0}
      onPageSelected={(evt) => {
        const { position } = evt.nativeEvent;
        setCurrentTab(tabs[position]);
        recalculateHeight(tabs[position]);
      }}
      useLegacy={type === 'SelectAsset' && Platform.OS === 'ios'}
    >
      {tabs.map((tab, index) => (
        <View key={tab} style={styles.pagerView}>
          <View ref={parentRefs[index]}>
            <View ref={childRefs[index]} onLayout={currentTab === tab ? () => recalculateHeight(tab) : undefined}>
              {tab === 'Tokens' ? (
                <TokensList
                  selectType={selectType}
                  showReceiveFunds={
                    type === 'Home' &&
                    currentNetwork?.networkType === NetworkType.Ethereum &&
                    (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId)
                  }
                  onPressItem={onPressItem}
                />
              ) : tab === 'NFTs' ? (
                <NFTsList tabsType={type} onPressItem={onPressItem} />
              ) : tab === 'Activity' ? (
                <ActivityList onPress={onPressItem as (v: Tx) => void} />
              ) : null}
            </View>
          </View>
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
