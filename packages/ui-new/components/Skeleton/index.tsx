import { useTheme } from '@react-navigation/native';
import { screenWidth } from '@utils/deviceInfo';
import type React from 'react';
import ContentLoader, { Rect } from 'react-content-loader/native';

interface Props {
  width: number;
  height: number;
  startX?: number;
  startY?: number;
}

const skeletonWidth = screenWidth - 32;

const Skeleton: React.FC<Props> = ({ width, height, startX = 0, startY = 0 }) => {
  const { colors } = useTheme();
  return (
    <ContentLoader
      speed={2}
      width={skeletonWidth}
      height={height}
      viewBox={`0 0 ${skeletonWidth} ${height}`}
      backgroundColor={colors.borderThird}
      foregroundColor={colors.foreg}
    >
      <Rect x={startX} y={startY} rx="3" ry="3" width={width} height={height} />
    </ContentLoader>
  );
};

export default Skeleton;
