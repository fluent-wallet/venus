import { useTheme } from '@react-navigation/native';
import { screenWidth } from '@utils/deviceInfo';
import { random } from 'lodash-es';
import type React from 'react';
import { memo } from 'react';
import ContentLoader, { Circle, Rect } from 'react-content-loader/native';

export const SkeletonList = memo(() => {
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
      <Rect x="64" y="26" rx="4" ry="4" width={random(140, 200)} height={18} />
    </ContentLoader>
  ));
});

const GRID_PADDING_LEFT = 56;
const GRID_PADDING_RIGHT = 16;
const GRID_GAP = 16;
const ITEM_PADDING_HORIZONTAL = 8;
const ITEM_BORDER_WIDTH = 1;

const itemOuterWidth = (screenWidth - GRID_PADDING_LEFT - GRID_PADDING_RIGHT - GRID_GAP) / 2;
const itemInnerWidth = itemOuterWidth - ITEM_PADDING_HORIZONTAL * 2 - ITEM_BORDER_WIDTH * 2;

const detailImgSize = itemInnerWidth;
const detailWidth = itemInnerWidth;
const detailHeight = itemInnerWidth + 46.5;
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
