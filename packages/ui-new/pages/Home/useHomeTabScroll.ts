import type { TabType } from '@modules/AssetsTabs/types';
import { useCallback, useMemo, useRef } from 'react';
import { type HostInstance, type LayoutChangeEvent, Platform } from 'react-native';
import { GestureStateManager, type NativeGestureConfig, useNativeGesture } from 'react-native-gesture-handler';
import { scrollTo, useAnimatedReaction, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { getHomeHeaderOffset, getHomeTabScrollOffset, HOME_SCROLL_TOLERANCE, type HomeScrollCoordinator } from './useHomeScrollCoordinator';

const shouldLockScrollDirection = Platform.OS === 'android';
const SCROLL_DIRECTION_LOCK_DISTANCE = 8;

export function useHomeTabScroll(tab: TabType, { selection, completedSequence, sharedScrollY, headerHeight, requestTabSync }: HomeScrollCoordinator) {
  const scrollOffset = useSharedValue(0);
  const nativeRef = useAnimatedRef<HostInstance>();
  const nativeReady = useSharedValue(false);
  // A negative value means content and viewport sizes are not both known yet.
  const maxScrollOffset = useSharedValue(-1);
  const touchStart = useSharedValue({ id: -1, x: 0, y: 0 });
  const scrollDirectionLocked = useSharedValue(false);
  const scrollGestureConfig = useMemo<NativeGestureConfig>(() => {
    if (!shouldLockScrollDirection) return {};
    return {
      // A fling must not make the vertical list intercept a new horizontal swipe on DOWN.
      manualActivation: true,
      onTouchesDown: (event) => {
        'worklet';
        if (event.numberOfTouches !== 1) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        touchStart.value = { id: touch.id, x: touch.absoluteX, y: touch.absoluteY };
        scrollDirectionLocked.value = false;
      },
      onTouchesMove: (event) => {
        'worklet';
        if (scrollDirectionLocked.value) return;
        const start = touchStart.value;
        const touch = event.allTouches.find((item) => item.id === start.id);
        if (!touch) return;
        const dx = Math.abs(touch.absoluteX - start.x);
        const dy = Math.abs(touch.absoluteY - start.y);
        if (Math.max(dx, dy) < SCROLL_DIRECTION_LOCK_DISTANCE || dx === dy) return;
        scrollDirectionLocked.value = true;
        if (dx > dy) {
          GestureStateManager.fail(event.handlerTag);
        } else {
          GestureStateManager.activate(event.handlerTag);
        }
      },
    };
  }, [scrollDirectionLocked, touchStart]);
  const scrollGesture = useNativeGesture(scrollGestureConfig);
  const lastNativeInstance = useRef<HostInstance | null>(null);
  const metrics = useRef({ contentHeight: -1, layoutHeight: 0 });

  const updateNativeReady = useCallback(
    (ready: boolean, isNewInstance: boolean) => {
      'worklet';
      if (isNewInstance) {
        maxScrollOffset.value = -1;
        if (selection.value.tab === tab) {
          requestTabSync(tab);
        }
        scrollOffset.value = 0;
      }
      nativeReady.value = ready;
    },
    [nativeReady, requestTabSync, maxScrollOffset, scrollOffset, selection, tab],
  );

  const setNativeRef = useCallback(
    (instance: HostInstance | null) => {
      nativeRef(instance);
      // Reattaching the same native view must keep its measurements and offset.
      const isNewInstance = instance !== null && instance !== lastNativeInstance.current;
      if (isNewInstance) {
        lastNativeInstance.current = instance;
        metrics.current = { contentHeight: -1, layoutHeight: 0 };
      }
      scheduleOnUI(updateNativeReady, instance !== null, isNewInstance);
    },
    [nativeRef, updateNativeReady],
  );

  useAnimatedReaction(
    () => ({
      selected: selection.value,
      headerOffset: getHomeHeaderOffset(sharedScrollY.value, headerHeight.value),
      headerHeight: headerHeight.value,
      offset: scrollOffset.value,
      maxOffset: maxScrollOffset.value,
      ready: nativeReady.value,
    }),
    ({ selected, headerOffset, headerHeight: height, offset, maxOffset, ready }) => {
      if (!ready || maxOffset < 0) return;
      const active = selected.tab === tab;
      if (active && completedSequence.value === selected.sequence) return;

      // Use the captured header offset until the selected page finishes syncing.
      const requiredHeaderOffset = active ? getHomeHeaderOffset(selected.headerOffset, height) : headerOffset;
      if (requiredHeaderOffset > maxOffset + HOME_SCROLL_TOLERANCE) return;
      const targetOffset = Math.min(getHomeTabScrollOffset(requiredHeaderOffset, offset, height), maxOffset);
      if (Math.abs(targetOffset - offset) > HOME_SCROLL_TOLERANCE) {
        // Native scroll events confirm the offset; commands never predict it.
        scrollTo(nativeRef, 0, targetOffset, false);
      } else if (active) {
        completedSequence.value = selected.sequence;
      }
    },
  );

  // Only the selected, synchronized page can drive the shared header.
  useAnimatedReaction(
    () => ({ offset: scrollOffset.value, selected: selection.value, completed: completedSequence.value, ready: nativeReady.value }),
    ({ offset, selected, completed, ready }) => {
      if (ready && selected.tab === tab && completed === selected.sequence) {
        sharedScrollY.value = offset;
      }
    },
  );

  const notifyMetricsChange = useCallback(() => {
    const { contentHeight, layoutHeight } = metrics.current;
    maxScrollOffset.set(contentHeight >= 0 && layoutHeight > 0 ? Math.max(contentHeight - layoutHeight, 0) : -1);
  }, [maxScrollOffset]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (metrics.current.layoutHeight === height) return;
      metrics.current.layoutHeight = height;
      notifyMetricsChange();
    },
    [notifyMetricsChange],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (metrics.current.contentHeight === height) return;
      metrics.current.contentHeight = height;
      notifyMetricsChange();
    },
    [notifyMetricsChange],
  );

  return useMemo(
    () => ({ scrollOffset, scrollGesture, nativeRef, setNativeRef, onLayout, onContentSizeChange }),
    [scrollOffset, scrollGesture, nativeRef, setNativeRef, onLayout, onContentSizeChange],
  );
}

export type HomeTabScrollBinding = ReturnType<typeof useHomeTabScroll>;
