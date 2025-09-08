import RefreshIconDark from '@assets/icons/refreshLogoDark.webp';
import RefreshIconLight from '@assets/icons/refreshLogoLight.webp';
import { useTheme } from '@react-navigation/native';
import { type ComponentProps, useCallback, useMemo, useRef } from 'react';
import { type NativeScrollEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const AnimatedScroll = Animated.createAnimatedComponent(ScrollView);
const CONSTANTS = {
  MAX_CONTENT_HEIGHT: 150,
  REFRESH_HEIGHT: 100,

  ANIMATION_DURATION: 200, // duration of the pull down animation
  ROTATE_DURATION: 1000, // duration of the rotation animation

  SCROLL_THROTTLE: 16, // scroll event throttle for the scroll view

  OPACITY_OFFSET: 2, // the offset at which the icon starts to become visible

  ICON_SIZE: 60, // size of the refresh icon
};

export interface Props extends Omit<ComponentProps<ScrollView>, 'onScroll'> {
  onScroll?: (evt: NativeScrollEvent) => void;
  onRefresh: (done: () => void) => void;
}

const RefreshScrollView: React.FC<Props> = ({ children, onRefresh, onScroll, stickyHeaderIndices, ...props }) => {
  const { mode } = useTheme();
  const scrollPosition = useSharedValue(0);
  const pullPosition = useSharedValue(0);
  const isReadyToRefresh = useSharedValue(false);
  const isRefreshing = useSharedValue(false);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const rotateValue = useSharedValue(0);

  const handleRefresh = useCallback(() => {
    pullPosition.value = withTiming(0, { reduceMotion: ReduceMotion.Never, duration: CONSTANTS.ANIMATION_DURATION });
    rotateValue.value = 0;
    isRefreshing.value = false;
  }, [pullPosition, isRefreshing, rotateValue]);
  // store the last scroll position
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (evt) => {
      scrollPosition.value = evt.contentOffset.y;
      if (onScroll) {
        runOnJS(onScroll)(evt);
      }
    },
  });

  const pullDownStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: pullPosition.value }],
    };
  });
  const refreshContainerStyles = useAnimatedStyle(() => {
    return {
      height: pullPosition.value,
    };
  });
  const refreshIconStyle = useAnimatedStyle(() => {
    return {
      opacity: Math.max(pullPosition.value - CONSTANTS.OPACITY_OFFSET, 0),
      transform: [
        {
          scale: Math.min(1, Math.max(0, pullPosition.value / CONSTANTS.REFRESH_HEIGHT)),
        },
        { rotate: `${rotateValue.value}deg` },
      ],
    };
  });

  // pan gesture
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollRef)
    .activeOffsetY(100)
    .onUpdate((e) => {
      if (scrollPosition.value <= 0 && e.translationY >= 0 && isRefreshing.value === false) {
        pullPosition.value = Math.max(Math.min(CONSTANTS.MAX_CONTENT_HEIGHT, e.translationY), 0);

        if (pullPosition.value >= CONSTANTS.REFRESH_HEIGHT && isReadyToRefresh.value === false) {
          isReadyToRefresh.value = true;
        }

        if (pullPosition.value < CONSTANTS.REFRESH_HEIGHT && isReadyToRefresh.value === true) {
          isReadyToRefresh.value = false;
        }
      }
    })
    .onEnd((_) => {
      if (isRefreshing.value) return;
      const refreshingHeight = 100;
      pullPosition.value = withTiming(isReadyToRefresh.value ? refreshingHeight : 0, {
        reduceMotion: ReduceMotion.Never,
        duration: CONSTANTS.ANIMATION_DURATION,
      });
      rotateValue.value = isReadyToRefresh.value
        ? withRepeat(withTiming(360, { duration: CONSTANTS.ROTATE_DURATION, reduceMotion: ReduceMotion.Never }), 0, false, undefined, ReduceMotion.Never)
        : 0;
      // pull is enough to trigger a refresh
      if (isReadyToRefresh.value) {
        isReadyToRefresh.value = false;
        isRefreshing.value = true;

        // call the onRefresh callback
        runOnJS(onRefresh)(handleRefresh);
      }
    });

  const refreshIcon = useMemo(() => (mode === 'dark' ? RefreshIconDark : RefreshIconLight), [mode]);

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.container}>
        <Animated.View style={[styles.refreshContainer, refreshContainerStyles]}>
          <Animated.Image source={refreshIcon} style={[styles.refreshIcon, refreshIconStyle]} />
        </Animated.View>
        <Animated.View style={[pullDownStyle, styles.container]}>
          <AnimatedScroll
            {...props}
            ref={scrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={CONSTANTS.SCROLL_THROTTLE}
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={stickyHeaderIndices}
          >
            {children}
          </AnimatedScroll>
        </Animated.View>
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

export default RefreshScrollView;
