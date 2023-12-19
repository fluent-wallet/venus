import { Text } from '@rneui/themed';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS, useAnimatedScrollHandler, interpolate, withSpring } from 'react-native-reanimated';

interface PullRefreshProps {
  containerStyle?: StyleProp<ViewStyle>;
  onRefresh?: (fn: () => void) => void;
}

const MAX_HEIGHT = 80;
const HEIGHT = 50;

const PullRefresh: React.FC<{ children: React.ReactNode } & PullRefreshProps> = ({ containerStyle, children, onRefresh: onFresh }) => {
  const height = useSharedValue(0);
  const isPull = useSharedValue(false);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (!isPull) {
        const y = e.y > 0 ? e.y : 0;
        height.value = withTiming(y > MAX_HEIGHT ? MAX_HEIGHT : y);
      }
    })
    .onEnd((e) => {
      if (e.y > MAX_HEIGHT) {
        height.value = withTiming(HEIGHT);
        isPull.value = true;
        if (onFresh) {
          runOnJS(onFresh)(function () {
            height.value = withTiming(0);
            isPull.value = false;
          });
        }
      }
    });
  return (
    <GestureDetector gesture={panGesture}>
      <View style={containerStyle}>
        <Animated.View style={{ height }} className="flex overflow-hidden">
          <ActivityIndicator size={'small'} style={{ marginStart: 7 }} />
        </Animated.View>
        {children}
      </View>
    </GestureDetector>
  );
};

export default PullRefresh;
