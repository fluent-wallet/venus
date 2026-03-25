import { Networks, NetworkType } from '@core/utils/consts';
import ActivityList from '@modules/ActivityList';
import NFTsList from '@modules/AssetsList/NFTsList';
import TokensList from '@modules/AssetsList/TokensList';
import type { INftItem } from '@service/core';
import { useCurrentNetwork } from '@service/network';
import type { AssetInfo } from '@utils/assetInfo';
import { screenHeight } from '@utils/deviceInfo';
import type React from 'react';
import { createRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTabs } from './hooks';
import type { TabsType, TabType } from './types';

interface TabsContentProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  type: TabsType;
  selectType: 'Send' | 'Receive' | 'Home';
  onlyToken?: boolean;
  showHomeBackupBanner?: boolean;
  onPressAsset?: (asset: AssetInfo, nftItemDetail?: INftItem) => void;
  onPressTx?: (txId: string) => void;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  currentTab,
  onTabChange,
  type,
  selectType,
  onlyToken,
  showHomeBackupBanner,
  onPressAsset,
  onPressTx,
}) => {
  const { data: currentNetwork } = useCurrentNetwork();
  const tabs = useTabs(type, onlyToken);
  const pageViewRef = useRef<PagerView>(null);
  const showBackupBanner = type === 'Home' && showHomeBackupBanner === true;

  const minHeight = useMemo(() => screenHeight - (selectType === 'Home' ? (showBackupBanner ? 450 : 340) : 300), [showBackupBanner, selectType]);
  const [pageViewHeight, setPageViewHeight] = useState<number | undefined>(() => undefined);
  const childRefs = useMemo(() => Array.from({ length: tabs.length }, () => createRef<View>()), [tabs]);

  const recalculateHeight = useCallback(
    (tab: TabType) => {
      const position = tabs.indexOf(tab);
      if (position === -1) return;
      const contentRef = childRefs[position].current;
      if (!contentRef) return;
      contentRef.measure((_x, _y, _width, height, _pageX, _pageY) => {
        setPageViewHeight(Math.max(height, minHeight));
      });
    },
    [childRefs, minHeight, tabs],
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
          <View ref={childRefs[index]} onLayout={currentTab === tab ? () => recalculateHeight(tab) : undefined}>
            {renderTabContent(tab)}
          </View>
        </View>
      ))}
    </PagerView>
  );
};

const styles = StyleSheet.create({
  pagerView: {
    flex: 1,
  },
});
