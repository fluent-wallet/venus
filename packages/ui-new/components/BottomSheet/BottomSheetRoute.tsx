import React, { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { useNavigation, type NavigationAction } from '@react-navigation/native';
import { BaseBottomSheet, type BaseBottomSheetProps, type BottomSheetCloseReason, type BottomSheetController } from './BaseBottomSheet';
import { isAdjustResize } from '@utils/deviceInfo';
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
  ref,
  ...rest
}: BottomSheetRouteProps) {
  const navigation = useNavigation();
  const sheetRef = useRef<BottomSheetController>(null);
  const currentIndexRef = useRef(0);
  const pendingActionRef = useRef<NavigationAction | null>(null);
  const isClosingRef = useRef(false);

  useImperativeHandle(ref, () => sheetRef.current as BottomSheetController, []);
  const handleChange = useCallback(
    (nextIndex: number, position: number, type: SNAP_POINT_TYPE) => {
      currentIndexRef.current = nextIndex;
      onChange?.(nextIndex, position, type);
    },
    [onChange],
  );

  const handleAfterClose = useCallback(
    (reason: BottomSheetCloseReason) => {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;

      isClosingRef.current = false;
      if (reason === 'confirm' || !action) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        return;
      }
      let targetNavigation: any = navigation;
      while (targetNavigation?.getParent?.()) {
        targetNavigation = targetNavigation.getParent();
      }

      const navToUse = targetNavigation ?? navigation;
      const currentKey = navToUse?.getState?.()?.key;
      if ('target' in action && action.target && currentKey && action.target !== currentKey) {
        navToUse.dispatch({ ...action, target: currentKey });
        return;
      }
      navToUse.dispatch(action);
    },
    [navigation],
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      const actionType = event.data.action?.type;
      if (actionType === 'RESET') {
        return;
      }

      if (currentIndexRef.current === -1) return;
      event.preventDefault();

      if (isClosingRef.current) return;
      isClosingRef.current = true;

      pendingActionRef.current = event.data.action;
      sheetRef.current?.close('cancel');
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
