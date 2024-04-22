import { Svg, Circle } from 'react-native-svg';
import Animated, { withRepeat, useSharedValue, ReduceMotion, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface Props {
  color: string;
  background?: string;
  width: number;
  height: number;
  strokeWidth?: number;
  styles?: StyleProp<ViewStyle>;
}

const Spinner = ({ width, height, color, background, styles = {}, strokeWidth = 3 }: Props) => {
  const sv = useSharedValue(0);
  const style = useAnimatedStyle(() => {
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
    <AnimatedSvg fill="none" viewBox="0 0 66 66" width={width} height={height} style={[style, styles]}>
      <Circle cx="33" cy="33" fill="none" r="28" stroke={background} strokeWidth={strokeWidth} />
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
