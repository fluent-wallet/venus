import React from 'react';
import { type useTheme } from '@react-navigation/native';
import ContentLoader, { Rect, Circle } from 'react-content-loader/native';
import { random } from 'lodash-es';
import { screenWidth } from '@utils/deviceInfo';

const ListItem = (key: string | number) => (
  <ContentLoader key={key} speed={2} width={screenWidth} height={70} viewBox={`0 0 ${screenWidth} 70`} backgroundColor="#f3f3f3" foregroundColor="#ecebeb">
    <Circle cx="36" cy="35" r="20" />
    <Rect x="64" y="26" rx="4" ry="4" width={random(140, 200)} height={18} />
  </ContentLoader>
);

export const SkeletonList = Array.from({ length: 6 }).map((_, index) => ListItem(index));

const detailImgSize = (screenWidth - 56 - 16 - 16) / 2 - 16;
const detailWidth = detailImgSize;
const detailHeight = detailImgSize + 46.5;
export const SkeletoDetailItem: React.FC<{ colors: ReturnType<typeof useTheme>['colors'] }> = ({ colors }) => (
  <ContentLoader
    speed={2}
    width={detailWidth}
    height={detailHeight}
    viewBox={`0 0 ${detailWidth} ${detailHeight}`}
    backgroundColor={colors.borderThird}
    foregroundColor={colors.foreg}
  >
    <Rect x="0" y="0" rx="6" ry="6" width={detailImgSize} height={detailImgSize} />
    <Rect x="0" y={detailImgSize + 10} rx="4" ry="4" width={detailImgSize / 2} height={16} />
    <Rect x="0" y={detailImgSize + 30} rx="4" ry="4" width={detailImgSize} height={18} />
  </ContentLoader>
);
