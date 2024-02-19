import { useCallback, useRef, forwardRef, type ComponentProps, useMemo } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import BottomSheet_, { BottomSheetModal, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
export * from '@gorhom/bottom-sheet';
export { BottomSheetModal as BottomSheetMethods } from '@gorhom/bottom-sheet';

interface Props extends ComponentProps<typeof BottomSheetModal> {
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
  isModal?: boolean;
}

const BottomSheet = forwardRef<BottomSheetModal, Props>(
  (
    {
      children,
      enablePanDownToClose = true,
      keyboardBlurBehavior = 'restore',
      backDropPressBehavior = 'close',
      handlePressBackdrop,
      isModal = true,
      onChange,
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

    return (
      <RenderBottomSheet
        ref={composeRef([_forwardRef!, bottomSheetRef])}
        index={defaultIndex}
        onChange={(index) => {
          indexRef.current = index;
          onChange?.(index);
        }}
        enablePanDownToClose={enablePanDownToClose}
        keyboardBlurBehavior={keyboardBlurBehavior}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.bgFourth }}
        handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
        {...props}
      >
        {children}
      </RenderBottomSheet>
    );
  },
);

export default BottomSheet;
