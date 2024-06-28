import RefreshIconDark from '@assets/icons/refreshLogoDark.webp';
import RefreshIconLight from '@assets/icons/refreshLogoLight.webp';
import { useTheme } from '@react-navigation/native';
import { type ComponentProps, useCallback, useRef } from 'react';
import { type NativeScrollEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

const AnimatedScroll = Animated.createAnimatedComponent(ScrollView);
const maxContentHeight = 150;
const refreshHeight = 100;

export interface Props extends Omit<ComponentProps<ScrollView>, 'onScroll'> {
  onScroll?: (evt: NativeScrollEvent) => void;
  onRefresh: (done: () => void) => void;
}

const HomeRefresh: React.FC<Props> = ({ children, onRefresh, onScroll, stickyHeaderIndices, ...props }) => {
  const { mode } = useTheme();
  const scrollPosition = useSharedValue(0);
  const pullPosition = useSharedValue(0);
  const isReadyToRefresh = useSharedValue(false);
  const isRefreshing = useSharedValue(false);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const rotateValue = useSharedValue(0);

  const handleRefresh = useCallback(() => {
    pullPosition.value = withTiming(0, { reduceMotion: ReduceMotion.Never, duration: 200 });
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
      opacity: Math.max(pullPosition.value - 2, 0),
      transform: [
        {
          scale: Math.min(1, Math.max(0, pullPosition.value / refreshHeight)),
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
        pullPosition.value = Math.max(Math.min(maxContentHeight, e.translationY), 0);

        if (pullPosition.value >= refreshHeight && isReadyToRefresh.value === false) {
          isReadyToRefresh.value = true;
        }

        if (pullPosition.value < refreshHeight && isReadyToRefresh.value === true) {
          isReadyToRefresh.value = false;
        }
      }
    })
    .onEnd((_) => {
      if (isRefreshing.value) return;
      const refreshingHeight = 100;
      pullPosition.value = withTiming(isReadyToRefresh.value ? refreshingHeight : 0, { reduceMotion: ReduceMotion.Never, duration: 200 });
      rotateValue.value = isReadyToRefresh.value
        ? withRepeat(withTiming(360, { duration: 1000, reduceMotion: ReduceMotion.Never }), 0, false, undefined, ReduceMotion.Never)
        : 0;
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
      <View style={styles.container}>
        <Animated.View style={[styles.refreshContainer, refreshContainerStyles]}>
          <Animated.Image source={mode === 'dark' ? RefreshIconDark : RefreshIconLight} style={[styles.refreshIcon, refreshIconStyle]} />
        </Animated.View>
        <Animated.View style={[pullDownStyle, styles.container]}>
          <AnimatedScroll
            {...props}
            ref={scrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
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
