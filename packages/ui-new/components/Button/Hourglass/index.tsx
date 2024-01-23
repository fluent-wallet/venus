import React, { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedProps, withTiming, withRepeat, interpolate } from 'react-native-reanimated';

const hourglass: React.FC = memo(() => {
  return (
    <Svg width="12" height="18" viewBox="0 0 12 18" fill="none">
      <Path
        d="M11.4 18v-5.4h-.01l.01-.009L7.8 9l3.6-3.6-.01-.009h.01V0H.6v5.391h.009l-.01.009L4.2 9 .6 12.591l.01.009h-.01V18h10.8zm-9-13.05V1.8h7.2v3.15L6 8.55l-3.6-3.6zM6 9.45l3.6 3.6v3.15H2.4v-3.15L6 9.45z"
        fill="#1E1E1E"
      />
    </Svg>
  );
});

export default hourglass;
