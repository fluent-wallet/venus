import { useCallback, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import Spin from '@components/Spin';

interface PullRefreshProps {
  containerStyle?: StyleProp<ViewStyle>;
  onRefresh?: (fn: () => void) => void;
}

const MAX_HEIGHT = 100;
const HEIGHT = 84;

const PullRefresh: React.FC<{ children: React.ReactNode } & PullRefreshProps> = ({ containerStyle, children, onRefresh: onFresh }) => {
  const height = useSharedValue(0);
  const isPull = useSharedValue(false);
  const [isSpin, setSpin] = useState(false);

  const refreshCallback = useCallback(() => {
    height.value = withTiming(0);
    isPull.value = false;
    setSpin(false);
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (!isPull.value) {
        const y = e.y > 0 ? e.y : 0;
        height.value = withTiming(y > MAX_HEIGHT ? MAX_HEIGHT : y);
      }
    })
    .onEnd((e) => {
      if (e.y > MAX_HEIGHT) {
        height.value = withTiming(HEIGHT);
        isPull.value = true;
        if (onFresh) {
          runOnJS(setSpin)(true);
          runOnJS(onFresh)(refreshCallback);
        }
      }
    });

    return (
    <GestureDetector gesture={panGesture}>
      <View style={containerStyle}>
        <Animated.View style={{ height }}>
          <View className="flex flex-1 items-center justify-center overflow-hidden">
            <Spin spin={isSpin} />
          </View>
        </Animated.View>
        {children}
      </View>
    </GestureDetector>
  );
};

export default PullRefresh;
