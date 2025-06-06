import { NetworkType, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import type { Tx } from '@core/database/models/Tx';
import { Networks } from '@core/utils/consts';
import ActivityList from '@modules/ActivityList';
import NFTsList from '@modules/AssetsList/NFTsList';

import TokensList from '@modules/AssetsList/TokensList';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';

import { screenHeight } from '@utils/deviceInfo';

import type React from 'react';
import { useCallback, useMemo, useState, createRef, type RefObject } from 'react';
import { StyleSheet, View, findNodeHandle } from 'react-native';
import PagerView from 'react-native-pager-view';

import type { Props, TabsArrayType, TabType } from './types';

const TAB_WIDTH = 64;

export const TabsContent: React.FC<Props> = ({ currentTab, setCurrentTab, pageViewRef, type, selectType, onlyToken, onPressItem }) => {
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
  const shouldShowNotBackup = useShouldShowNotBackup();

  const minHeight = useMemo(() => screenHeight - (selectType === 'Home' ? (shouldShowNotBackup ? 450 : 340) : 300), [shouldShowNotBackup, selectType]);
  const [pageViewHeight, setPageViewHeight] = useState<number | undefined>(() => undefined);
  const parentRefs = useMemo<RefObject<View>[]>(() => Array.from({ length: tabs.length }).map(() => createRef()), [tabs]);
  const childRefs = useMemo<RefObject<View>[]>(() => Array.from({ length: tabs.length }).map(() => createRef()), [tabs]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const recalculateHeight = useCallback(
    (tab: TabType) => {
      const position = tabs.indexOf(tab);
      if (position === -1) return;
      const childNumber = findNodeHandle(parentRefs[position].current);
      if (childNumber === null) return;
      childRefs[position].current?.measure((_x, _y, _width, height, _pageX, _pageY) => {
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
