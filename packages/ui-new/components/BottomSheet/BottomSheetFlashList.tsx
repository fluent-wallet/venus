import { type BottomSheetScrollableProps, useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import type React from 'react';
import { forwardRef, memo, type Ref } from 'react';
import type { ScrollViewProps } from 'react-native';

export type BottomSheetFlashListProps<T> = Omit<FlashListProps<T>, 'renderScrollComponent'> & BottomSheetScrollableProps;

const BottomSheetFlashListBase = forwardRef<FlashListRef<unknown>, BottomSheetFlashListProps<unknown>>(
  ({ focusHook, scrollEventsHandlersHook, enableFooterMarginAdjustment, ...props }, ref) => {
    const renderScrollComponent = useBottomSheetScrollableCreator<ScrollViewProps>({
      focusHook,
      scrollEventsHandlersHook,
      enableFooterMarginAdjustment,
    });

    return <FlashList {...props} ref={ref} renderScrollComponent={renderScrollComponent} />;
  },
);

BottomSheetFlashListBase.displayName = 'BottomSheetFlashList';

type BottomSheetFlashListComponent = <T>(
  props: BottomSheetFlashListProps<T> & {
    ref?: Ref<FlashListRef<T>>;
  },
) => React.ReactElement;

export const BottomSheetFlashList = memo(BottomSheetFlashListBase) as BottomSheetFlashListComponent;
