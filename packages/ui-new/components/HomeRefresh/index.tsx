import { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import RefreshIcon from '@assets/icons/refreshLogo.webp';

const AnimatedScroll = Animated.createAnimatedComponent(ScrollView);
const maxContentHeight = 150;
const refreshHeight = 100;

const HomeRefresh: React.FC<
  React.PropsWithChildren<{
    onRefresh: (done: () => void) => void;
    onScroll?: (event: NativeScrollEvent) => void;
    stickyHeaderIndices?: number[];
  }>
> = ({ children, onRefresh, onScroll, stickyHeaderIndices }) => {
  const scrollPosition = useSharedValue(0);
  const pullPosition = useSharedValue(0);
  const isReadyToRefresh = useSharedValue(false);
  const isRefreshing = useSharedValue(false);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const handleRefresh = useCallback(() => {
    pullPosition.value = withTiming(0, { reduceMotion: ReduceMotion.Never, duration: 200 });
    isRefreshing.value = false;
  }, [pullPosition, isRefreshing]);
  // store the last scroll position
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollPosition.value = e.contentOffset.y;
      if (onScroll) {
        runOnJS(onScroll)(e);
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
      opacity: Math.max(pullPosition.value - 2, 0),
      transform: [
        {
          scale: Math.min(1, Math.max(0, pullPosition.value / refreshHeight)),
        },
      ],
    };
  });
  // pan gesture
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(scrollRef)
    .onUpdate((e) => {
      if (scrollPosition.value <= 0 && e.translationY >= 0 && isRefreshing.value === false) {
        pullPosition.value = Math.max(Math.min(maxContentHeight, e.translationY), 0);

        if (pullPosition.value >= refreshHeight && isReadyToRefresh.value === false) {
          isReadyToRefresh.value = true;
        }

        if (pullPosition.value < refreshHeight && isReadyToRefresh.value === true) {
          isReadyToRefresh.value = false;
        }
      }
    })
    .onEnd((e) => {
      if (isRefreshing.value) return;
      const refreshingHeight = 100;
      pullPosition.value = withTiming(isReadyToRefresh.value ? refreshingHeight : 0, { reduceMotion: ReduceMotion.Never, duration: 200 });

      // pull is enough to trigger a refresh
      if (isReadyToRefresh.value) {
        isReadyToRefresh.value = false;
        isRefreshing.value = true;

        // call the onRefresh callback
        runOnJS(onRefresh)(handleRefresh);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={style.container}>
        <Animated.View style={[style.refreshContainer, refreshContainerStyles]}>
          <Animated.Image source={RefreshIcon} style={[style.refreshIcon, refreshIconStyle]} />
        </Animated.View>
        <Animated.View style={[pullDownStyle]}>
          <AnimatedScroll
            ref={scrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={30}
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
const style = StyleSheet.create({
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
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    marginTop: -30,
    marginLeft: -30,
  },
});

export default HomeRefresh;
