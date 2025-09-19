import { useCallback, useImperativeHandle, useRef, useState, type ForwardedRef } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetProps, type SNAP_POINT_TYPE } from '@gorhom/bottom-sheet';
export interface BaseBottomSheetProps extends BottomSheetProps {
  ref?: ForwardedRef<BottomSheet>;
  showBackDrop?: boolean;
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
  controlledIndex?: number;
  defaultIndex?: number;
  onAfterClose?: () => void;
  onOpen?: () => void;
}

export function BaseBottomSheet({
  ref,
  children,
  showBackDrop = true,
  enablePanDownToClose = true,
  enableContentPanningGesture = true,
  enableHandlePanningGesture = true,
  backDropPressBehavior = 'close',
  handlePressBackdrop,
  onChange,
  onClose,
  onOpen,
  controlledIndex,
  defaultIndex = -1,
  onAfterClose,
  ...rest
}: BaseBottomSheetProps) {
  const { colors, palette } = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  useImperativeHandle(ref, () => sheetRef.current as BottomSheet, []);

  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
  const currentIndex = controlledIndex ?? uncontrolledIndex;
  const indexRef = useRef(currentIndex);
  indexRef.current = currentIndex;
  const [canPanDownToClose, setCanPanDownToClose] = useState(() => Platform.OS === 'ios');
  const hasOpenedRef = useRef(false);

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
      if (controlledIndex === undefined) {
        setUncontrolledIndex(nextIndex);
      }
      indexRef.current = nextIndex;

      if (nextIndex >= 0 && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
        onOpen?.();
      }
      if (nextIndex === -1) {
        hasOpenedRef.current = false;
      }

      onChange?.(nextIndex, position, type);

      const updatePan = () => setCanPanDownToClose(nextIndex >= 0);

      if (Platform.OS === 'android') {
        setTimeout(updatePan, 250);
      } else {
        updatePan();
      }
    },
    [controlledIndex, onChange, onOpen],
  );

  const handleClose = useCallback(() => {
    hasOpenedRef.current = false;
    onClose?.();
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
    }
    onAfterClose?.();
  }, [onClose, onAfterClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={currentIndex}
      onChange={handleChange}
      onClose={handleClose}
      enablePanDownToClose={canPanDownToClose && enablePanDownToClose}
      enableContentPanningGesture={enableContentPanningGesture}
      enableHandlePanningGesture={canPanDownToClose && enableHandlePanningGesture}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bgFourth }}
      handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
      {...rest}
    >
      {children}
    </BottomSheet>
  );
}
