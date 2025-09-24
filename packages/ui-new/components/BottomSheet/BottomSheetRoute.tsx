import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { BaseBottomSheet, type BaseBottomSheetProps } from './BaseBottomSheet';
import { isAdjustResize } from '@utils/deviceInfo';
import type BottomSheet from '@gorhom/bottom-sheet';
import type { SNAP_POINT_TYPE } from '@gorhom/bottom-sheet';

type BottomSheetRouteProps = Omit<BaseBottomSheetProps, 'index' | 'onAfterClose'>;

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
  const currentIndexRef = useRef(0);

  const handleChange = useCallback(
    (nextIndex: number, position: number, type: SNAP_POINT_TYPE) => {
      currentIndexRef.current = nextIndex;
      onChange?.(nextIndex, position, type);
    },
    [onChange],
  );

  const handleAfterClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (currentIndexRef.current === -1) return;
      const actionType = event.data?.action?.type;
      if (['RESET', 'NAVIGATE', 'REPLACE'].includes(actionType)) return;
      console.log('BottomSheetRoute beforeRemove event', { actionType });
      event.preventDefault();
      sheetRef.current?.close();
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <BaseBottomSheet
      ref={sheetRef}
      index={0}
      showBackDrop={showBackDrop}
      backDropPressBehavior={backDropPressBehavior}
      handlePressBackdrop={handlePressBackdrop}
      enablePanDownToClose={enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={enableHandlePanningGesture}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode={android_keyboardInputMode}
      onChange={handleChange}
      onAfterClose={handleAfterClose}
      {...rest}
    />
  );
}
