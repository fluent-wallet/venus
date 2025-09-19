import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { BaseBottomSheet, type BaseBottomSheetProps } from './BaseBottomSheet';
import { isAdjustResize } from '@utils/deviceInfo';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { SNAP_POINT_TYPE } from '@gorhom/bottom-sheet';

type BottomSheetRouteProps = Omit<BaseBottomSheetProps, 'controlledIndex' | 'defaultIndex' | 'onAfterClose'>;

export function BottomSheetRoute({
  showBackDrop = true,
  backDropPressBehavior = 'close',
  handlePressBackdrop,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  keyboardBlurBehavior = 'restore',
  android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
  onChange,
  ...rest
}: BottomSheetRouteProps) {
  const navigation = useNavigation();
  const sheetRef = useRef<BottomSheet>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleChange = useCallback(
    (nextIndex: number, position: number, type: SNAP_POINT_TYPE) => {
      setCurrentIndex(nextIndex);
      onChange?.(nextIndex, position, type);
    },
    [onChange],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (currentIndex === -1) {
        return;
      }
      event.preventDefault();
      sheetRef.current?.close();
    });
    return unsubscribe;
  }, [navigation, currentIndex]);

  return (
    <BaseBottomSheet
      ref={sheetRef}
      defaultIndex={0}
      showBackDrop={showBackDrop}
      backDropPressBehavior={backDropPressBehavior}
      handlePressBackdrop={handlePressBackdrop}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={enableHandlePanningGesture}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode={android_keyboardInputMode}
      onChange={handleChange}
      onAfterClose={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }}
      {...rest}
    />
  );
}
