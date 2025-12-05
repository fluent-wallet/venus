import { useTheme } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import type React from 'react';
import { memo } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import SourceBlack from './hourglass.json';
import SourceWhite from './hourglass-white.json';

const Hourglass: React.FC<{ style?: StyleProp<ViewStyle> }> = memo(({ style }) => {
  const { mode } = useTheme();

  return (
    <View style={style} pointerEvents="none">
      <LottieView source={mode === 'dark' ? SourceWhite : SourceBlack} style={{ width: '100%', height: '100%' }} autoPlay loop />
    </View>
  );
});

export default Hourglass;
