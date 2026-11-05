import type { TabType } from '@modules/AssetsTabs/types';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

interface HomeTabSelection {
  tab: TabType;
  headerOffset: number;
  sequence: number;
}

export const HOME_SCROLL_TOLERANCE = 1;

export function getHomeHeaderOffset(scrollOffset: number, collapseDistance: number) {
  'worklet';
  const offset = Math.min(Math.max(scrollOffset, 0), collapseDistance);
  // Treat fractional native offsets near the boundary as fully collapsed.
  return collapseDistance - offset <= HOME_SCROLL_TOLERANCE ? collapseDistance : offset;
}

export function getHomeTabScrollOffset(headerOffset: number, tabOffset: number, collapseDistance: number) {
  'worklet';
  const visibleOffset = getHomeHeaderOffset(headerOffset, collapseDistance);
  // Keep a tab's deeper position only while the shared header is fully collapsed.
  return visibleOffset < collapseDistance ? visibleOffset : Math.max(visibleOffset, tabOffset);
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
  const selection = useSharedValue<HomeTabSelection>({ tab: currentTab, headerOffset: 0, sequence: 0 });
  const completedSequence = useSharedValue(0);
  const headerHeight = useSharedValue(collapseDistance);

  useLayoutEffect(() => {
    headerHeight.set(collapseDistance);
  }, [collapseDistance, headerHeight]);

  const requestTabSync = useCallback(
    (tab: TabType) => {
      'worklet';
      selection.value = {
        tab,
        headerOffset: getHomeHeaderOffset(sharedScrollY.value, headerHeight.value),
        sequence: selection.value.sequence + 1,
      };
    },
    [headerHeight, selection, sharedScrollY],
  );

  useLayoutEffect(() => {
    scheduleOnUI(requestTabSync, currentTab);
  }, [currentTab, requestTabSync]);

  return useMemo(
    () => ({ selection, completedSequence, sharedScrollY, headerHeight, requestTabSync }),
    [selection, completedSequence, sharedScrollY, headerHeight, requestTabSync],
  );
}

export type HomeScrollCoordinator = ReturnType<typeof useHomeScrollCoordinator>;
