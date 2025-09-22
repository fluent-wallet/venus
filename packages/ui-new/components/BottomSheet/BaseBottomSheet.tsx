import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetProps, type SNAP_POINT_TYPE } from '@gorhom/bottom-sheet';

const getMaxDetentIndex = (snapPoints: BaseBottomSheetProps['snapPoints']) => {
  const extractLength = (points: typeof snapPoints) => {
    if (!points) return 0;
    if (Array.isArray(points)) return points.length;
    if (typeof points === 'object' && 'value' in points) {
      const value = (points as { value?: unknown }).value;
      if (Array.isArray(value)) return value.length;
    }
    return 0;
  };
  return extractLength(snapPoints) + 2;
};

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
  useImperativeHandle(ref, () => sheetRef.current as BottomSheet, []);

  const [canPanDownToClose, setCanPanDownToClose] = useState(() => Platform.OS === 'ios');
  const hasOpenedRef = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const lastStableIndexRef = useRef<number>(index ?? -1);
  const isRestoringRef = useRef(false);
  const maxAllowedIndex = useMemo(() => getMaxDetentIndex(snapPoints), [snapPoints]);

  const MIN_KEYBOARD_INDEX = -1000;
  const keyboardVisibleRef = useRef(false);

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

  const restoreToStableIndex = useCallback(() => {
    if (isRestoringRef.current) return;
    const target = lastStableIndexRef.current;
    isRestoringRef.current = true;
    indexRef.current = target;

    requestAnimationFrame(() => {
      if (target === -1) {
        sheetRef.current?.close();
      } else {
        sheetRef.current?.snapToIndex?.(target);
      }
      isRestoringRef.current = false;
    });
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
      const inRange = Number.isInteger(nextIndex) && nextIndex >= MIN_KEYBOARD_INDEX && nextIndex <= maxAllowedIndex;

      if (!inRange) {
        indexRef.current = nextIndex;
        if (!keyboardVisibleRef.current) {
          restoreToStableIndex();
        }
        setCanPanDownToClose(lastStableIndexRef.current >= 0);
        return;
      }

      const isKeyboardTempIndex = nextIndex < -1;

      indexRef.current = nextIndex;
      if (!isKeyboardTempIndex) {
        lastStableIndexRef.current = nextIndex;
      }

      if (nextIndex >= 0 && !hasOpenedRef.current) {
        hasOpenedRef.current = true;
        onOpen?.();
      }
      if (nextIndex === -1) {
        hasOpenedRef.current = false;
      }

      onChange?.(nextIndex, position, type);

      const effectiveIndex = isKeyboardTempIndex ? lastStableIndexRef.current : nextIndex;
      setCanPanDownToClose(effectiveIndex >= 0);
    },
    [maxAllowedIndex, onChange, onOpen, restoreToStableIndex],
  );

  const handleClose = useCallback(() => {
    hasOpenedRef.current = false;
    lastStableIndexRef.current = -1;
    onClose?.();
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
    }
    onAfterClose?.();
  }, [onClose, onAfterClose]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      const currentIndex = indexRef.current;
      const inRange = Number.isInteger(currentIndex) && currentIndex >= MIN_KEYBOARD_INDEX && currentIndex <= maxAllowedIndex;

      if (!inRange || currentIndex < -1) {
        restoreToStableIndex();
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [maxAllowedIndex, restoreToStableIndex]);

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
