import type { TabType } from '@modules/AssetsTabs/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';
import type { HomeActivityRow } from './HomeActivityTab';
import type { HomeNftsRow } from './HomeNftsTab';
import type { HomeFlashListRef, HomeFlatListRef } from './HomeTabList';
import type { HomeTokensRow } from './HomeTokensTab';

interface HomeTabMetrics {
  contentHeight: number;
  layoutHeight: number;
}

type HomeTabMetricsMap = Record<TabType, HomeTabMetrics>;

interface PendingTabSync {
  tab: TabType;
  minimumVisibleOffset: number;
}

function createInitialMetrics(): HomeTabMetrics {
  return {
    contentHeight: -1,
    layoutHeight: 0,
  };
}

function createInitialMetricsMap(): HomeTabMetricsMap {
  return {
    Tokens: createInitialMetrics(),
    NFTs: createInitialMetrics(),
    Activity: createInitialMetrics(),
  };
}

function areTabMetricsReady(metrics: HomeTabMetrics) {
  return metrics.layoutHeight > 0 && metrics.contentHeight >= 0;
}

export function useHomeScrollCoordinator({
  collapseDistance,
  currentTab,
  sharedScrollY,
}: {
  collapseDistance: number;
  currentTab: TabType;
  sharedScrollY: SharedValue<number>;
}) {
  const previousTabRef = useRef(currentTab);
  const tokensListRef = useRef<HomeFlashListRef<HomeTokensRow> | null>(null);
  const nftsListRef = useRef<HomeFlatListRef<HomeNftsRow> | null>(null);
  const activityListRef = useRef<HomeFlashListRef<HomeActivityRow> | null>(null);
  const tokensScrollOffset = useSharedValue(0);
  const nftsScrollOffset = useSharedValue(0);
  const activityScrollOffset = useSharedValue(0);
  const [pendingSync, setPendingSync] = useState<PendingTabSync | null>(null);
  const [tabMetrics, setTabMetrics] = useState<HomeTabMetricsMap>(() => createInitialMetricsMap());

  const getListRef = useCallback((tab: TabType) => {
    switch (tab) {
      case 'Tokens':
        return tokensListRef;
      case 'NFTs':
        return nftsListRef;
      case 'Activity':
        return activityListRef;
      default:
        return tokensListRef;
    }
  }, []);

  const getScrollOffset = useCallback(
    (tab: TabType) => {
      switch (tab) {
        case 'Tokens':
          return tokensScrollOffset;
        case 'NFTs':
          return nftsScrollOffset;
        case 'Activity':
          return activityScrollOffset;
        default:
          return tokensScrollOffset;
      }
    },
    [activityScrollOffset, nftsScrollOffset, tokensScrollOffset],
  );

  const updateTabMetrics = useCallback((tab: TabType, nextMetrics: Partial<HomeTabMetrics>) => {
    setTabMetrics((prev) => {
      const currentMetrics = prev[tab];
      const updatedMetrics: HomeTabMetrics = {
        contentHeight: nextMetrics.contentHeight ?? currentMetrics.contentHeight,
        layoutHeight: nextMetrics.layoutHeight ?? currentMetrics.layoutHeight,
      };

      if (currentMetrics.contentHeight === updatedMetrics.contentHeight && currentMetrics.layoutHeight === updatedMetrics.layoutHeight) {
        return prev;
      }

      return {
        ...prev,
        [tab]: updatedMetrics,
      };
    });
  }, []);

  const resolveReachableOffset = useCallback(
    (tab: TabType, desiredOffset: number) => {
      const metrics = tabMetrics[tab];
      if (!areTabMetricsReady(metrics)) {
        return null;
      }

      const maxOffset = Math.max(metrics.contentHeight - metrics.layoutHeight, 0);
      return Math.min(desiredOffset, maxOffset);
    },
    [tabMetrics],
  );

  const syncVisibleOffsetToTab = useCallback(
    (tab: TabType, minimumVisibleOffset: number) => {
      const currentOffset = getScrollOffset(tab).get();
      if (currentOffset >= minimumVisibleOffset) {
        if (currentTab === tab) {
          sharedScrollY.set(currentOffset);
        }
        return true;
      }

      const ref = getListRef(tab).current;
      if (!ref) {
        return false;
      }

      const resolvedOffset = resolveReachableOffset(tab, minimumVisibleOffset);
      if (resolvedOffset === null) {
        return false;
      }

      if (resolvedOffset !== currentOffset) {
        ref.scrollToOffset({ offset: resolvedOffset, animated: false });
      }
      getScrollOffset(tab).value = resolvedOffset;
      if (currentTab === tab) {
        sharedScrollY.set(resolvedOffset);
      }
      return true;
    },
    [currentTab, getListRef, getScrollOffset, resolveReachableOffset, sharedScrollY],
  );

  useEffect(() => {
    const previousTab = previousTabRef.current;
    if (previousTab === currentTab) {
      return;
    }

    const sourceOffset = getScrollOffset(previousTab).get();
    setPendingSync({
      tab: currentTab,
      minimumVisibleOffset: Math.min(sourceOffset, collapseDistance),
    });
    previousTabRef.current = currentTab;
  }, [collapseDistance, currentTab, getScrollOffset]);

  useEffect(() => {
    if (!pendingSync) {
      return;
    }

    if (!syncVisibleOffsetToTab(pendingSync.tab, pendingSync.minimumVisibleOffset)) {
      return;
    }

    setPendingSync((current) => {
      if (!current || current.tab !== pendingSync.tab || current.minimumVisibleOffset !== pendingSync.minimumVisibleOffset) {
        return current;
      }
      return null;
    });
  }, [pendingSync, syncVisibleOffsetToTab]);

  return {
    activityListRef,
    activityScrollOffset,
    nftsListRef,
    nftsScrollOffset,
    tokensListRef,
    tokensScrollOffset,
    updateTabMetrics,
  };
}
