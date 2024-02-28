import { useCallback, useRef, forwardRef, useMemo } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { clamp } from 'lodash-es';
import BottomSheet_, { BottomSheetModal, BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetModalProps } from '@gorhom/bottom-sheet';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import { screenHeight } from '@utils/deviceInfo';
export * from '@gorhom/bottom-sheet';
export { BottomSheetModal as BottomSheetMethods } from '@gorhom/bottom-sheet';

interface Props extends BottomSheetModalProps {
  showBackDrop?: boolean;
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

const BottomSheet = forwardRef<BottomSheetModal, Props>(
  (
    {
      children,
      showBackDrop = true,
      enablePanDownToClose = true,
      keyboardBlurBehavior = 'restore',
      backDropPressBehavior = 'close',
      handlePressBackdrop,
      isModal = true,
      onChange,
      onDismiss,
      onClose,
      index,
      ...props
    },
    _forwardRef,
  ) => {
    const { colors, palette } = useTheme();

    const indexRef = useRef(-1);
    const bottomSheetRef = useRef<BottomSheetModal>(null);

    const RenderBottomSheet = useMemo(() => (isModal ? BottomSheetModal : BottomSheet_), [isModal]);
    const defaultIndex = useMemo(() => (isModal ? 0 : -1), [isModal]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={backDropPressBehavior}
          enableTouchThrough={false}
          onPress={handlePressBackdrop}
        />
      ),
      [backDropPressBehavior, handlePressBackdrop],
    );

    const onBackPress = useCallback(() => {
      if (indexRef.current !== -1) {
        if (isModal) {
          bottomSheetRef.current?.dismiss();
        } else {
          bottomSheetRef.current?.close();
        }
        return true;
      }
      return false;
    }, [isModal]);

    useFocusEffect(
      useCallback(() => {
        BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }, [onBackPress]),
    );

    const handleDismiss = useCallback(() => {
      if (!isModal) return;
      onDismiss?.();
      Keyboard.dismiss();
    }, [isModal, onDismiss]);

    const handleClose = useCallback(() => {
      if (isModal) return;
      onClose?.();
      Keyboard.dismiss();
    }, [isModal, onClose]);

    return (
      <RenderBottomSheet
        ref={composeRef([_forwardRef!, bottomSheetRef])}
        index={index ?? defaultIndex}
        onChange={(index) => {
          indexRef.current = index;
          onChange?.(index);
        }}
        onDismiss={handleDismiss}
        onClose={handleClose}
        enablePanDownToClose={enablePanDownToClose}
        keyboardBlurBehavior={keyboardBlurBehavior}
        backdropComponent={showBackDrop ? renderBackdrop : undefined}
        backgroundStyle={{ backgroundColor: colors.bgFourth }}
        handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
        {...props}
      >
        {children}
      </RenderBottomSheet>
    );
  },
);

export const snapPoints = {
  large: [`${((clamp(screenHeight - 124, 628, screenHeight - 40) / screenHeight) * 100).toFixed(2)}%`],
} as const;

export default BottomSheet;
