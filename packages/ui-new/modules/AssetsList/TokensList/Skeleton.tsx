import { useTheme } from '@react-navigation/native';
import { screenWidth } from '@utils/deviceInfo';
import { random } from 'lodash-es';
import ContentLoader, { Rect, Circle } from 'react-content-loader/native';
import { memo } from 'react';

const Skeleton = memo(() => {
  const { colors } = useTheme();
  return Array.from({ length: 6 }).map((_, index) => (
    <ContentLoader
      key={index}
      speed={2}
      width={screenWidth}
      height={70}
      viewBox={`0 0 ${screenWidth} 70`}
      backgroundColor={colors.borderThird}
      foregroundColor={colors.foreg}
    >
      <Circle cx="36" cy="35" r="20" />
      <Rect x="64" y="15" rx="4" ry="4" width={random(120, 180)} height={18} />
      <Rect x="64" y="39" rx="4" ry="4" width={random(80, 140)} height={18} />
    </ContentLoader>
  ));
});

export default Skeleton;
