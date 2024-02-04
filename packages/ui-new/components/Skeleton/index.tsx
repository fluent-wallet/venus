import React from 'react';
import ContentLoader, { Rect, Circle } from 'react-content-loader/native';
import { screenWidth } from '@utils/deviceInfo';

interface Props {
  width?: number;
  height?: number;
}

const skeletonWidth = screenWidth - 32;

const Skeleton: React.FC<Props> = ({ width, height }) => (
  <ContentLoader speed={2} width={skeletonWidth} height={height} viewBox={`0 0 ${skeletonWidth} ${height}`} backgroundColor="#f3f3f3" foregroundColor="#ecebeb">
    <Rect x="0" y="0" rx="3" ry="3" width={width} height={height} />
  </ContentLoader>
);

export default Skeleton;
