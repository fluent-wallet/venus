import React, { useMemo, useEffect, useCallback, Fragment } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { atom, useAtomValue } from 'jotai';
import PagerView from 'react-native-pager-view';
import { useCurrentNetwork, setAtom, NetworkType } from '@core/WalletCore/Plugins/ReactInject';
import { type AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { CFX_ESPACE_MAINNET_CHAINID, CFX_ESPACE_TESTNET_CHAINID } from '@core/consts/network';
import Text from '@components/Text';
import TokensList from '@modules/AssetsList/TokensList';
import NFTsList from '@modules/AssetsList/NFTsList';
import ActivityList from '@modules/ActivityList';
import { StickyNFTItem } from '@modules/AssetsList/NFTsList/NFTItem';

export type Tab = 'Tokens' | 'NFTs' | 'Activity';
export type TabsType = 'Home' | 'SelectAsset';
type Tabs = Array<Tab>;
const TAB_WIDTH = 64;

interface Props {
  type: TabsType;
  currentTab: Tab;
  pageViewRef: React.RefObject<PagerView>;
  setCurrentTab: (tab: Tab) => void;
  onPressItem?: (v: AssetInfo) => void;
  onlyToken?: boolean;
}

export const Tabs: React.FC<Omit<Props, 'setCurrentTab' | 'onPressItem'>> = ({ type, currentTab, pageViewRef, onlyToken }) => {
  const { colors } = useTheme();

  const currentNetwork = useCurrentNetwork();
  const tabs = useMemo(() => {
    const res =
      !onlyToken && (!currentNetwork || (currentNetwork && (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    mapOfSetScrollY[type](0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);
  useEffect(() => {
    return () => {
      mapOfSetScrollY[type](0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <View style={[styles.tabsSelector, { backgroundColor: type !== 'Home' ? colors.bgFourth : colors.bgPrimary }]}>
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
  const scrollY = mapOfUseTabPageViewScrollY[type]();
  const startY = useMemo(() => (type === 'Home' ? 200 : 1), [type]);
  return <StickyNFTItem scrollY={scrollY} startY={startY} tabsType={type} />;
};

export const TabsContent: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef, type, onPressItem }) => {
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
          {tab === 'Tokens' && index === currentTabIndex && (
            <TokensList
              showReceiveFunds={
                currentNetwork?.networkType === NetworkType.Ethereum &&
                (currentNetwork.chainId === CFX_ESPACE_MAINNET_CHAINID || currentNetwork.chainId === CFX_ESPACE_TESTNET_CHAINID)
              }
              onPressItem={onPressItem}
            />
          )}
          {tab === 'NFTs' && index === currentTabIndex && <NFTsList tabsType={type} onPressItem={onPressItem} />}
          {tab === 'Activity' && index === currentTabIndex && <ActivityList />}
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
    position: 'relative',
    height: 1,
  },
  pagerView: {
    flex: 1,
  },
});