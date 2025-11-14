import React, { useCallback, useImperativeHandle, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { BaseBottomSheet, type BaseBottomSheetProps } from './BaseBottomSheet';
import { isAdjustResize } from '@utils/deviceInfo';

type BottomSheetRouteProps = Omit<BaseBottomSheetProps, 'index'>;

export function BottomSheetRoute({
  showBackDrop = true,
  backDropPressBehavior = 'close',
  handlePressBackdrop,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  keyboardBlurBehavior = 'restore',
  android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
  onClose,
  onAfterClose,
  onChange,
  ref,
  ...rest
}: BottomSheetRouteProps) {
  const navigation = useNavigation();
  const sheetRef = useRef<BottomSheet | null>(null);

  useImperativeHandle(ref, () => sheetRef.current as BottomSheet, []);

  const handleClose = useCallback(() => {
    onClose?.();
    onAfterClose?.();

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, onClose, onAfterClose]);

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
      onClose={handleClose}
      onChange={onChange}
      {...rest}
    />
  );
}
