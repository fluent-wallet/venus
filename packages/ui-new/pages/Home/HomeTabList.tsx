import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import { forwardRef, useCallback, useMemo } from 'react';
import { type FlatList, Platform, type ScrollViewInstance, type ScrollViewProps, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useScrollOffset } from 'react-native-reanimated';
import type { HomeTabScrollBinding } from './useHomeTabScroll';

export interface HomeContentRow {
  key: string;
  kind: string;
}

interface HomeFlashScrollContainerProps extends ScrollViewProps {
  scroll: HomeTabScrollBinding;
}

const HomeFlashScrollContainer = forwardRef<ScrollViewInstance, HomeFlashScrollContainerProps>(({ scroll, ...props }, forwardedRef) => {
  const { scrollOffset, scrollGesture, nativeRef, setNativeRef } = scroll;
  // Preserve FlashList's own scroll events for virtualization.
  useScrollOffset(nativeRef, scrollOffset);
  const setRef = useCallback(
    (instance: ScrollViewInstance | null) => {
      setNativeRef(instance?.getNativeScrollRef() ?? null);
      if (typeof forwardedRef === 'function') {
        forwardedRef(instance);
      } else if (forwardedRef) {
        forwardedRef.current = instance;
      }
    },
    [setNativeRef, forwardedRef],
  );

  return (
    <GestureDetector gesture={scrollGesture}>
      <Animated.ScrollView {...props} ref={setRef} />
    </GestureDetector>
  );
});

HomeFlashScrollContainer.displayName = 'HomeFlashScrollContainer';

interface HomeBaseListProps<T extends HomeContentRow> {
  contentRows: T[];
  renderContentItem: (item: T) => React.ReactElement | null;
  topInset: number;
  minimumContentHeight: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scroll: HomeTabScrollBinding;
  removeClippedSubviews?: boolean;
}

const keyExtractor = (item: HomeContentRow) => item.key;
// Scroll coordination owns position; FlashList must not adjust it independently.
const maintainVisibleContentPosition = { disabled: true };

export const HomeTabList = <T extends HomeContentRow>({
  contentRows,
  renderContentItem,
  topInset,
  minimumContentHeight,
  contentContainerStyle,
  scroll,
  removeClippedSubviews = Platform.OS === 'android',
}: HomeBaseListProps<T>) => {
  const { scrollOffset, setNativeRef } = scroll;
  const resolvedContentContainerStyle = useMemo(
    () => [styles.contentContainer, { paddingTop: topInset, minHeight: minimumContentHeight }, contentContainerStyle],
    [contentContainerStyle, minimumContentHeight, topInset],
  );
  const setRef = useCallback(
    (instance: FlatList<T> | null) => {
      setNativeRef(instance?.getNativeScrollRef() ?? null);
    },
    [setNativeRef],
  );
  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
    },
  });
  const renderItem = useCallback(({ item }: { item: T }) => renderContentItem(item), [renderContentItem]);

  return (
    <GestureDetector gesture={scroll.scrollGesture}>
      <Animated.FlatList
        data={contentRows}
        ref={setRef}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={resolvedContentContainerStyle}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={removeClippedSubviews}
        bounces={false}
        overScrollMode="never"
        style={styles.list}
        onLayout={scroll.onLayout}
        onContentSizeChange={scroll.onContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    </GestureDetector>
  );
};

export const HomeFlashTabList = <T extends HomeContentRow>({
  contentRows,
  renderContentItem,
  topInset,
  minimumContentHeight,
  contentContainerStyle,
  scroll,
  getItemType,
  removeClippedSubviews = Platform.OS === 'android',
}: {
  getItemType?: (item: T, index: number, extraData?: unknown) => string | number | undefined;
} & HomeBaseListProps<T>) => {
  const resolvedContentContainerStyle = useMemo(
    () => [styles.contentContainer, { paddingTop: topInset, minHeight: minimumContentHeight }, contentContainerStyle],
    [contentContainerStyle, minimumContentHeight, topInset],
  );
  const renderItem = useCallback<ListRenderItem<T>>(({ item }) => renderContentItem(item), [renderContentItem]);
  const renderScrollComponent = useCallback((props: ScrollViewProps) => <HomeFlashScrollContainer {...props} scroll={scroll} />, [scroll]);

  return (
    <FlashList
      data={contentRows}
      renderItem={renderItem}
      renderScrollComponent={renderScrollComponent}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      contentContainerStyle={resolvedContentContainerStyle}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={removeClippedSubviews}
      bounces={false}
      overScrollMode="never"
      maintainVisibleContentPosition={maintainVisibleContentPosition}
      style={styles.list}
      onLayout={scroll.onLayout}
      onContentSizeChange={scroll.onContentSizeChange}
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
