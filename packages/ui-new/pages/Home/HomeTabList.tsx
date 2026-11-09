import { FlashList, type FlashListProps, type ListRenderItem } from '@shopify/flash-list';
import type React from 'react';
import { forwardRef, useCallback, useMemo } from 'react';
import { Platform, type ScrollViewInstance, type ScrollViewProps, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useScrollOffset } from 'react-native-reanimated';
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
  getItemType?: FlashListProps<T>['getItemType'];
  stickyHeaderIndices?: FlashListProps<T>['stickyHeaderIndices'];
  stickyHeaderConfig?: FlashListProps<T>['stickyHeaderConfig'];
  onViewableItemsChanged?: FlashListProps<T>['onViewableItemsChanged'];
  viewabilityConfig?: FlashListProps<T>['viewabilityConfig'];
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
  getItemType,
  stickyHeaderIndices,
  stickyHeaderConfig,
  onViewableItemsChanged,
  viewabilityConfig,
  removeClippedSubviews = Platform.OS === 'android',
}: HomeBaseListProps<T>) => {
  // FlashList adds the sticky offset before its first item.
  const contentTopInset = topInset - (stickyHeaderConfig?.offset ?? 0);
  const resolvedContentContainerStyle = useMemo(
    () => [styles.contentContainer, { paddingTop: contentTopInset, minHeight: minimumContentHeight }, contentContainerStyle],
    [contentContainerStyle, minimumContentHeight, contentTopInset],
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
      stickyHeaderIndices={stickyHeaderIndices}
      stickyHeaderConfig={stickyHeaderConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
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
