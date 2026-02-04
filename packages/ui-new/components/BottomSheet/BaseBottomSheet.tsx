import BottomSheet, { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetProps, type SNAP_POINT_TYPE } from '@gorhom/bottom-sheet';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { type ForwardedRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';

type NativeBottomSheetProps = Omit<BottomSheetProps, 'ref' | 'onClose' | 'onAfterClose'>;

export interface BaseBottomSheetProps extends NativeBottomSheetProps {
  ref?: ForwardedRef<BottomSheet>;
  onClose?: () => void;
  onAfterClose?: () => void;
  showBackDrop?: boolean;
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
  onOpen?: () => void;
}

export function BaseBottomSheet({
  ref,
  children,
  showBackDrop = true,
  index = -1,
  snapPoints,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  backDropPressBehavior = 'close',
  handlePressBackdrop,
  onChange,
  onClose,
  onOpen,
  onAfterClose,
  enableDynamicSizing = false,
  activeOffsetY = 66,
  activeOffsetX = 0,
  ...rest
}: BaseBottomSheetProps) {
  const { colors, palette } = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const [canPanDownToClose, setCanPanDownToClose] = useState(() => Platform.OS === 'ios');
  const hasOpenedRef = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  useImperativeHandle(ref, () => sheetRef.current as BottomSheet | null, []);
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => {
      if (!showBackDrop) return null;
      const touchThrough = indexRef.current === -1 || !canPanDownToClose;
      return (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-0.6}
          appearsOnIndex={0}
          pressBehavior={touchThrough ? 'none' : backDropPressBehavior}
          enableTouchThrough={touchThrough}
          onPress={handlePressBackdrop}
        />
      );
    },
    [showBackDrop, canPanDownToClose, backDropPressBehavior, handlePressBackdrop],
  );

  const handleHardwareBack = useCallback(() => {
    if (indexRef.current !== -1) {
      sheetRef.current?.close();
      return true;
    }
    return false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
      return () => sub.remove();
    }, [handleHardwareBack]),
  );

  const handleChange = useCallback(
    (nextIndex: number, position: number, type: SNAP_POINT_TYPE) => {
      indexRef.current = nextIndex;

      if (nextIndex >= 0 && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
        onOpen?.();
      }
      if (nextIndex === -1) {
        hasOpenedRef.current = false;
      }

      onChange?.(nextIndex, position, type);

      setCanPanDownToClose(nextIndex >= 0);
    },
    [onChange, onOpen],
  );

  const handleClose = useCallback(() => {
    hasOpenedRef.current = false;

    onClose?.();
    onAfterClose?.();

    if (Keyboard.isVisible()) Keyboard.dismiss();
  }, [onClose, onAfterClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={index}
      onChange={handleChange}
      onClose={handleClose}
      enablePanDownToClose={canPanDownToClose && enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={canPanDownToClose && enableHandlePanningGesture}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bgFourth }}
      handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
      enableDynamicSizing={enableDynamicSizing}
      activeOffsetY={activeOffsetY}
      activeOffsetX={activeOffsetX}
      {...rest}
    >
      {children}
    </BottomSheet>
  );
}
