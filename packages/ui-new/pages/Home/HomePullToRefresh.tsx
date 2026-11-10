import RefreshIconDark from '@assets/icons/refreshLogoDark.webp';
import RefreshIconLight from '@assets/icons/refreshLogoLight.webp';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, type NativeGesture, type PanGestureConfig, usePanGesture } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, type SharedValue, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const CONSTANTS = {
  MAX_CONTENT_HEIGHT: 150,
  REFRESH_HEIGHT: 100,
  HORIZONTAL_FAIL_DISTANCE: 20,
  ANIMATION_DURATION: 200,
  ROTATE_DURATION: 1000,
  OPACITY_OFFSET: 2,
  ICON_SIZE: 60,
};

export const HomePullToRefresh: React.FC<{
  scrollY: SharedValue<number>;
  onRefresh: () => Promise<void>;
  nativeScrollGesture: NativeGesture;
  children: React.ReactNode;
}> = ({ scrollY, onRefresh, nativeScrollGesture, children }) => {
  const { mode } = useTheme();
  const pullPosition = useSharedValue(0);
  const isReadyToRefresh = useSharedValue(false);
  const isRefreshing = useSharedValue(false);
  const rotateValue = useSharedValue(0);

  const finishRefresh = useCallback(() => {
    pullPosition.value = withTiming(0, { reduceMotion: ReduceMotion.Never, duration: CONSTANTS.ANIMATION_DURATION });
    rotateValue.value = 0;
    isRefreshing.value = false;
  }, [isRefreshing, pullPosition, rotateValue]);

  const triggerRefresh = useCallback(() => {
    void onRefresh().finally(finishRefresh);
  }, [finishRefresh, onRefresh]);

  const pullDownStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pullPosition.value }],
  }));

  const refreshContainerStyle = useAnimatedStyle(() => ({
    height: pullPosition.value,
  }));

  const refreshIconStyle = useAnimatedStyle(() => ({
    opacity: Math.max(pullPosition.value - CONSTANTS.OPACITY_OFFSET, 0),
    transform: [
      {
        scale: Math.min(1, Math.max(0, pullPosition.value / CONSTANTS.REFRESH_HEIGHT)),
      },
      { rotate: `${rotateValue.value}deg` },
    ],
  }));

  const panConfig = useMemo<PanGestureConfig>(
    () => ({
      simultaneousWith: nativeScrollGesture,
      activeOffsetY: 100,
      failOffsetX: [-CONSTANTS.HORIZONTAL_FAIL_DISTANCE, CONSTANTS.HORIZONTAL_FAIL_DISTANCE],
      onUpdate: (event) => {
        'worklet';
        if (scrollY.value <= 0 && event.translationY >= 0 && isRefreshing.value === false) {
          pullPosition.value = Math.max(Math.min(CONSTANTS.MAX_CONTENT_HEIGHT, event.translationY), 0);

          if (pullPosition.value >= CONSTANTS.REFRESH_HEIGHT && isReadyToRefresh.value === false) {
            isReadyToRefresh.value = true;
          }

          if (pullPosition.value < CONSTANTS.REFRESH_HEIGHT && isReadyToRefresh.value === true) {
            isReadyToRefresh.value = false;
          }
        }
      },
      onDeactivate: (event) => {
        'worklet';
        if (isRefreshing.value) return;

        const shouldRefresh = isReadyToRefresh.value && !event.canceled;
        isReadyToRefresh.value = false;
        pullPosition.value = withTiming(shouldRefresh ? CONSTANTS.REFRESH_HEIGHT : 0, {
          reduceMotion: ReduceMotion.Never,
          duration: CONSTANTS.ANIMATION_DURATION,
        });
        rotateValue.value = shouldRefresh
          ? withRepeat(withTiming(360, { duration: CONSTANTS.ROTATE_DURATION, reduceMotion: ReduceMotion.Never }), 0, false, undefined, ReduceMotion.Never)
          : 0;

        if (shouldRefresh) {
          isRefreshing.value = true;
          scheduleOnRN(triggerRefresh);
        }
      },
    }),
    [isReadyToRefresh, isRefreshing, nativeScrollGesture, pullPosition, rotateValue, scrollY, triggerRefresh],
  );
  const pan = usePanGesture(panConfig);

  const refreshIcon = useMemo(() => (mode === 'dark' ? RefreshIconDark : RefreshIconLight), [mode]);

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        <Animated.View style={[styles.refreshContainer, refreshContainerStyle]}>
          <Animated.Image source={refreshIcon} style={[styles.refreshIcon, refreshIconStyle]} />
        </Animated.View>
        <Animated.View style={[styles.container, pullDownStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  refreshContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: {
    width: CONSTANTS.ICON_SIZE,
    height: CONSTANTS.ICON_SIZE,
  },
});
