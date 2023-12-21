import { useTheme } from '@rneui/themed';
import { useEffect } from 'react';
import { View } from 'react-native';

import Animated, { useSharedValue, withRepeat, withTiming, Easing, cancelAnimation, useAnimatedStyle } from 'react-native-reanimated';
import { Svg, Path } from 'react-native-svg';

interface SpinProps {
  color?: string;
  backgroundColor?: string;
  spin?: boolean;
  width?: number;
  height?: number;
}

const Spin: React.FC<SpinProps> = ({ color, backgroundColor, spin = true, width = 24, height = 24 }) => {
  const { theme } = useTheme();

  const rotation = useSharedValue(0);
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          rotateZ: `${rotation.value}deg`,
        },
      ],
    };
  }, [rotation.value, spin]);

  useEffect(() => {
    if (!spin) {
      rotation.value = 0;
    } else {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        200
      );
      return () => cancelAnimation(rotation);
    }
  }, [spin, rotation]);
  return (
    <View>
      <Animated.View style={animatedStyles}>
        <Svg width={width} height={height} viewBox="0 0 24 24" fill={backgroundColor || theme.colors.surfaceBrand}>
          <Path
            opacity="0.3"
            d="M24 12C24 18.6274 18.6274 24 12 24C5.37258 24 0 18.6274 0 12C0 5.37258 5.37258 0 12 0C18.6274 0 24 5.37258 24 12ZM3.7418 12C3.7418 16.5609 7.43912 20.2582 12 20.2582C16.5609 20.2582 20.2582 16.5609 20.2582 12C20.2582 7.43912 16.5609 3.7418 12 3.7418C7.43912 3.7418 3.7418 7.43912 3.7418 12Z"
            fill="#333"
          />
          <Path
            d="M22.13 12c1.032 0 1.885-.843 1.724-1.863a12 12 0 0 0-9.99-9.991C12.842-.014 12 .838 12 1.87c0 1.033.848 1.85 1.855 2.082a8.259 8.259 0 0 1 6.192 6.192C20.28 11.152 21.096 12 22.13 12z"
            fill={color || theme.colors.surfaceBrand}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default Spin;
