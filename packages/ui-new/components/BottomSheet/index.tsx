import { useCallback, useRef, forwardRef, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useFocusEffect, useTheme, useNavigation } from '@react-navigation/native';
import { clamp } from 'lodash-es';
import BottomSheet_, { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetProps } from '@gorhom/bottom-sheet';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import { screenHeight, isAdjustResize } from '@utils/deviceInfo';
export * from '@gorhom/bottom-sheet';
export { default as BottomSheetMethods } from '@gorhom/bottom-sheet';

interface Props extends BottomSheetProps {
  showBackDrop?: boolean;
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
  onClose?: () => void;
  onOpen?: () => void;
  isRoute?: boolean;
}

const BottomSheet = forwardRef<BottomSheet_, Props>(
  (
    {
      children,
      isRoute = false,
      showBackDrop = true,
      enablePanDownToClose = true,
      backDropPressBehavior = 'close',
      keyboardBlurBehavior = 'restore',
      android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
      handlePressBackdrop,
      onChange,
      onClose,
      onOpen,
      index,
      ...props
    },
    _forwardRef,
  ) => {
    const { colors, palette } = useTheme();
    const navigation = useNavigation();

    const indexRef = useRef(-1);
    const bottomSheetRef = useRef<BottomSheet_>(null);

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
        bottomSheetRef.current?.close();
        return true;
      }
      return false;
    }, []);

    useFocusEffect(
      useCallback(() => {
        BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
      }, [onBackPress]),
    );

    const handleClose = useCallback(() => {
      onClose?.();
      if (Keyboard.isVisible()) {
        Keyboard.dismiss();
      }
      if (isRoute) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRoute, onClose]);

    const [couldPanDownToClose, setCouldPanDownToClose] = useState(false);

    return (
      <BottomSheet_
        ref={composeRef([_forwardRef!, bottomSheetRef])}
        index={index ?? (isRoute ? 0 : -1)}
        onChange={(index, position, type) => {
          indexRef.current = index;
          onChange?.(index, position, type);
          if (index === 0 && typeof onOpen === 'function') {
            onOpen();
          }
          if (index >= 0) {
            setTimeout(() => setCouldPanDownToClose(true), 200);
          } else {
            setTimeout(() => setCouldPanDownToClose(false), 200);
          }
        }}
        onClose={handleClose}
        enablePanDownToClose={couldPanDownToClose && enablePanDownToClose}
        backdropComponent={showBackDrop ? renderBackdrop : undefined}
        backgroundStyle={{ backgroundColor: colors.bgFourth }}
        handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
        android_keyboardInputMode={android_keyboardInputMode}
        keyboardBlurBehavior={keyboardBlurBehavior}
        enableDynamicSizing={false}
        animateOnMount={true}
        {...props}
      >
        {children}
      </BottomSheet_>
    );
  },
);

export const snapPoints = {
  large: [`${((clamp(screenHeight - 100, 628, screenHeight - 40) / screenHeight) * 100).toFixed(2)}%`] as string[],
  percent75: ['75%'] as string[],
} as const;

export default BottomSheet;
