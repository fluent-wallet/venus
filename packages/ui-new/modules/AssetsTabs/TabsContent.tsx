import { Networks, NetworkType } from '@core/utils/consts';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import ActivityList from '@modules/ActivityList';
import NFTsList from '@modules/AssetsList/NFTsList';
import TokensList from '@modules/AssetsList/TokensList';
import { useShouldShowNotBackup } from '@pages/Home/NotBackup';
import type { INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import { screenHeight } from '@utils/deviceInfo';
import type React from 'react';
import { createRef, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTabs } from './hooks';
import type { TabsType, TabType } from './types';

const TAB_WIDTH = 64;
interface TabsHeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  type: TabsType;
  selectType: 'Send' | 'Receive' | 'Home';
  onlyToken?: boolean;
  onPressAsset?: (asset: AssetInfo, nftItemDetail?: INftItem) => void;
  onPressTx?: (txId: string) => void;
}

export const TabsContent: React.FC<TabsHeaderProps> = ({ currentTab, onTabChange, type, selectType, onlyToken, onPressAsset, onPressTx }) => {
  const { data: currentNetwork } = useCurrentNetwork();
  const tabs = useTabs(type, onlyToken);
  const shouldShowNotBackup = useShouldShowNotBackup();
  const pageViewRef = useRef<PagerView>(null);

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

  const renderTabContent = useCallback(
    (tab: TabType) => {
      switch (tab) {
        case 'Tokens':
          return (
            <TokensList
              selectType={selectType}
              showReceiveFunds={
                type === 'Home' &&
                currentNetwork?.networkType === NetworkType.Ethereum &&
                (currentNetwork.chainId === Networks['Conflux eSpace'].chainId || currentNetwork.chainId === Networks['eSpace Testnet'].chainId)
              }
              onPressItem={onPressAsset}
            />
          );
        case 'NFTs':
          return (
            <NFTsList
              tabsType={type}
              onPressItem={(asset, item) => {
                onPressAsset?.(asset, item);
              }}
            />
          );
        case 'Activity':
          return <ActivityList onPress={onPressTx} />;
        default:
          return null;
      }
    },
    [type, selectType, currentNetwork, onPressAsset, onPressTx],
  );

  useEffect(() => {
    let index = tabs.indexOf(currentTab);
    index = index === -1 ? 0 : index;
    pageViewRef?.current?.setPage(index);
  }, [currentTab, tabs]);

  return (
    <PagerView
      ref={pageViewRef}
      style={[styles.pagerView, { minHeight, height: pageViewHeight }]}
      initialPage={0}
      onPageSelected={(evt) => {
        const { position } = evt.nativeEvent;
        onTabChange(tabs[position]);
        recalculateHeight(tabs[position]);
      }}
    >
      {tabs.map((tab, index) => (
        <View key={tab} style={styles.pagerView}>
          <View ref={parentRefs[index]}>
            <View ref={childRefs[index]} onLayout={currentTab === tab ? () => recalculateHeight(tab) : undefined}>
              {renderTabContent(tab)}
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
