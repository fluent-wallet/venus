import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import { forwardRef, type RefObject, useCallback, useEffect, useImperativeHandle, useMemo } from 'react';
import {
  type LayoutChangeEvent,
  Platform,
  type FlatList as RNFlatList,
  type ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';

export interface HomeContentRow {
  key: string;
  kind: string;
}

export type HomeFlatListRef<T> = RNFlatList<T>;
export type HomeFlashListRef<T> = FlashListRef<T>;

interface HomeFlashScrollContainerProps extends ScrollViewProps {
  isActive: SharedValue<number>;
  scrollGesture: GestureType;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
}

const HomeFlashScrollContainer = forwardRef<ScrollView, HomeFlashScrollContainerProps>(
  ({ isActive, scrollGesture, scrollOffset, sharedScrollY, ...props }, forwardedRef) => {
    const animatedRef = useAnimatedRef<ScrollView>();
    useScrollOffset(animatedRef, scrollOffset);
    useAnimatedReaction(
      () => scrollOffset.value,
      (offsetY) => {
        if (isActive.value === 1) {
          sharedScrollY.value = offsetY;
        }
      },
      [isActive, sharedScrollY],
    );
    useImperativeHandle(forwardedRef, () => animatedRef.current as unknown as ScrollView, [animatedRef]);

    return (
      <GestureDetector gesture={scrollGesture}>
        <Animated.ScrollView {...props} ref={animatedRef} />
      </GestureDetector>
    );
  },
);

HomeFlashScrollContainer.displayName = 'HomeFlashScrollContainer';

interface HomeBaseListProps<T extends HomeContentRow> {
  contentRows: T[];
  renderContentItem: (item: T) => React.ReactElement | null;
  topInset: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
  isActive: boolean;
  scrollGesture: GestureType;
  onLayoutHeightChange?: (height: number) => void;
  onContentHeightChange?: (height: number) => void;
}

function applyScrollOffset({
  offsetY,
  scrollOffset,
  sharedScrollY,
  isActive,
}: {
  offsetY: number;
  scrollOffset: SharedValue<number>;
  sharedScrollY: SharedValue<number>;
  isActive: boolean;
}) {
  'worklet';
  scrollOffset.value = offsetY;
  if (isActive) {
    sharedScrollY.value = offsetY;
  }
}

function useHomeListState({
  topInset,
  contentContainerStyle: contentContainerStyleOverride,
  scrollOffset,
  sharedScrollY,
  isActive,
  onLayoutHeightChange,
  onContentHeightChange,
}: Pick<
  HomeBaseListProps<HomeContentRow>,
  'topInset' | 'contentContainerStyle' | 'scrollOffset' | 'sharedScrollY' | 'isActive' | 'onLayoutHeightChange' | 'onContentHeightChange'
>) {
  const contentContainerStyle = useMemo(
    () => [styles.contentContainer, { paddingTop: topInset }, contentContainerStyleOverride],
    [contentContainerStyleOverride, topInset],
  );
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      applyScrollOffset({ offsetY: event.contentOffset.y, scrollOffset, sharedScrollY, isActive });
    },
  });
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayoutHeightChange?.(event.nativeEvent.layout.height);
    },
    [onLayoutHeightChange],
  );
  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      onContentHeightChange?.(height);
    },
    [onContentHeightChange],
  );

  return { contentContainerStyle, handleScroll, handleLayout, handleContentSizeChange };
}

export const HomeTabList = <T extends HomeContentRow>({
  flatListRef,
  contentRows,
  renderContentItem,
  topInset,
  contentContainerStyle,
  scrollOffset,
  sharedScrollY,
  isActive,
  scrollGesture,
  onLayoutHeightChange,
  onContentHeightChange,
  removeClippedSubviews = Platform.OS === 'android',
}: {
  flatListRef: RefObject<HomeFlatListRef<T> | null>;
  removeClippedSubviews?: boolean;
} & HomeBaseListProps<T>) => {
  const {
    contentContainerStyle: resolvedContentContainerStyle,
    handleScroll,
    handleLayout,
    handleContentSizeChange,
  } = useHomeListState({
    topInset,
    contentContainerStyle,
    scrollOffset,
    sharedScrollY,
    isActive,
    onLayoutHeightChange,
    onContentHeightChange,
  });

  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.FlatList
        data={contentRows}
        ref={flatListRef}
        renderItem={({ item }) => renderContentItem(item)}
        keyExtractor={(item) => item.key}
        contentContainerStyle={resolvedContentContainerStyle}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={removeClippedSubviews}
        bounces={false}
        overScrollMode="never"
        style={styles.list}
        onLayout={handleLayout}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    </GestureDetector>
  );
};

export const HomeFlashTabList = <T extends HomeContentRow>({
  flatListRef,
  contentRows,
  renderContentItem,
  topInset,
  contentContainerStyle,
  scrollOffset,
  sharedScrollY,
  isActive,
  scrollGesture,
  getItemType,
  onLayoutHeightChange,
  onContentHeightChange,
  removeClippedSubviews = Platform.OS === 'android',
}: {
  flatListRef: RefObject<HomeFlashListRef<T> | null>;
  getItemType?: (item: T, index: number, extraData?: unknown) => string | number | undefined;
  removeClippedSubviews?: boolean;
} & HomeBaseListProps<T>) => {
  const isActiveValue = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    isActiveValue.value = isActive ? 1 : 0;
  }, [isActive, isActiveValue]);
  const {
    contentContainerStyle: resolvedContentContainerStyle,
    handleLayout,
    handleContentSizeChange,
  } = useHomeListState({
    topInset,
    contentContainerStyle,
    scrollOffset,
    sharedScrollY,
    isActive,
    onLayoutHeightChange,
    onContentHeightChange,
  });
  const renderItem = useCallback<ListRenderItem<T>>(({ item }) => renderContentItem(item), [renderContentItem]);
  const renderScrollComponent = useCallback(
    (props: ScrollViewProps) => (
      <HomeFlashScrollContainer {...props} isActive={isActiveValue} scrollGesture={scrollGesture} scrollOffset={scrollOffset} sharedScrollY={sharedScrollY} />
    ),
    [isActiveValue, scrollGesture, scrollOffset, sharedScrollY],
  );

  return (
    <FlashList
      data={contentRows}
      ref={flatListRef}
      renderItem={renderItem}
      renderScrollComponent={renderScrollComponent}
      keyExtractor={(item) => item.key}
      getItemType={getItemType}
      contentContainerStyle={resolvedContentContainerStyle}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={removeClippedSubviews}
      bounces={false}
      overScrollMode="never"
      maintainVisibleContentPosition={{ disabled: true }}
      style={styles.list}
      onLayout={handleLayout}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 16,
  },
});
