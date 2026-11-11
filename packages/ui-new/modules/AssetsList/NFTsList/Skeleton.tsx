import { useTheme } from '@react-navigation/native';
import { screenWidth } from '@utils/deviceInfo';
import { random } from 'lodash-es';
import type React from 'react';
import { memo } from 'react';
import ContentLoader, { Circle, Rect } from 'react-content-loader/native';
import { StyleSheet, View } from 'react-native';

const DETAIL_SKELETON_KEYS = ['detail-skeleton-1', 'detail-skeleton-2'] as const;
const COLLECTION_SKELETON_KEYS = ['collection-1', 'collection-2', 'collection-3', 'collection-4', 'collection-5', 'collection-6'] as const;

export const NftCollectionItemsSkeleton: React.FC<{ background: 'home' | 'sheet' }> = memo(({ background }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailSkeletonWrapper, { backgroundColor: background === 'home' ? colors.bgPrimary : colors.bgFourth }]}>
      {DETAIL_SKELETON_KEYS.map((key) => (
        <View key={key} style={[styles.detailSkeletonItem, { borderColor: colors.borderThird }]}>
          <SkeletoDetailItem colors={colors} />
        </View>
      ))}
    </View>
  );
});

export const SkeletonList = memo(() => {
  const { colors } = useTheme();
  return COLLECTION_SKELETON_KEYS.map((key) => (
    <ContentLoader
      key={key}
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

const styles = StyleSheet.create({
  detailSkeletonWrapper: {
    marginVertical: 4,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingLeft: 56,
    paddingRight: 16,
    gap: 16,
  },
  detailSkeletonItem: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
});
