import React, { memo } from 'react';
import { type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import LottieView from 'lottie-react-native';

const Hourglass: React.FC<{ color: string; style: StyleProp<ViewStyle> }> = memo(({ color, style }) => {
  return (
    <View style={style}>
      <LottieView source={require('./hourglass.json')} style={{ width: '100%', height: '100%' }} autoPlay loop />
    </View>
  );
});

export default Hourglass;
