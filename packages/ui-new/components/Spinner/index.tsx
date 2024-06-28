import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { withRepeat, useSharedValue, ReduceMotion, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Circle, Svg } from 'react-native-svg';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface Props {
  color: string;
  backgroundColor?: string;
  width: number;
  height: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

const Spinner: React.FC<Props> = ({ width, height, color, backgroundColor, style, strokeWidth = 3 }) => {
  const sv = useSharedValue(0);
  const animateStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${sv.value}deg` }],
    };
  });

  useEffect(() => {
    sv.value = withRepeat(
      withTiming(360, { duration: 1500, reduceMotion: ReduceMotion.Never, easing: Easing.linear }),
      0,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, []);

  return (
    <AnimatedSvg fill="none" viewBox="0 0 66 66" width={width} height={height} style={[style, animateStyle]}>
      <Circle cx="33" cy="33" fill="none" r="28" stroke={backgroundColor} strokeWidth={strokeWidth} />
      <Circle
        cx="33"
        cy="33"
        fill="none"
        r="28"
        stroke={color}
        strokeDasharray="50, 174"
        strokeDashoffset="306"
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </AnimatedSvg>
  );
};

export default Spinner;
