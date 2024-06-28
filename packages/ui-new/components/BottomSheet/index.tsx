import composeRef from '@cfx-kit/react-utils/dist/composeRef';
import BottomSheet_, { BottomSheetBackdrop, type BottomSheetBackdropProps, type BottomSheetProps } from '@gorhom/bottom-sheet';
import { useFocusEffect, useNavigation, useTheme } from '@react-navigation/native';
import { isAdjustResize, screenHeight } from '@utils/deviceInfo';
import { clamp } from 'lodash-es';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
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
      enableContentPanningGesture = true,
      enableHandlePanningGesture = true,
      enableDynamicSizing = false,
      animateOnMount = true,
      backDropPressBehavior = 'close',
      keyboardBlurBehavior = 'restore',
      android_keyboardInputMode = isAdjustResize ? 'adjustResize' : 'adjustPan',
      handlePressBackdrop,
      onChange,
      onClose,
      onOpen,
      index,
      activeOffsetY = 66,
      activeOffsetX = 0,
      ...props
    },
    _forwardRef,
  ) => {
    const { colors, palette } = useTheme();
    const navigation = useNavigation();

    const indexRef = useRef(-1);
    const bottomSheetRef = useRef<BottomSheet_>(null);
    const [couldPanDownToClose, setCouldPanDownToClose] = useState(() => Platform.OS === 'ios');

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={couldPanDownToClose ? backDropPressBehavior : 'none'}
          enableTouchThrough={false}
          onPress={handlePressBackdrop}
        />
      ),
      [couldPanDownToClose, backDropPressBehavior, handlePressBackdrop],
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

    const timeRef = useRef<NodeJS.Timeout | null>(null);
    const handleClose = useCallback(() => {
      timeRef.current && clearTimeout(timeRef.current);
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
    }, [onClose]);

    useEffect(() => {
      if (isRoute) {
        timeRef.current = setTimeout(() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 666);
      }
      return () => {
        timeRef.current && clearTimeout(timeRef.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRoute]);

    return (
      <BottomSheet_
        ref={composeRef([_forwardRef!, bottomSheetRef])}
        index={index ?? (isRoute ? 0 : -1)}
        onChange={(index, position, type) => {
          index === 0 && timeRef.current && clearTimeout(timeRef.current);
          indexRef.current = index;
          onChange?.(index, position, type);
          if (index === 0 && typeof onOpen === 'function') {
            onOpen();
          }
          if (Platform.OS === 'android') {
            setTimeout(() => setCouldPanDownToClose(index >= 0), 250);
          }
        }}
        onClose={handleClose}
        enablePanDownToClose={couldPanDownToClose && enablePanDownToClose}
        enableContentPanningGesture={couldPanDownToClose && enableContentPanningGesture}
        enableHandlePanningGesture={couldPanDownToClose && enableHandlePanningGesture}
        backdropComponent={showBackDrop ? renderBackdrop : undefined}
        backgroundStyle={{ backgroundColor: colors.bgFourth }}
        handleIndicatorStyle={{ backgroundColor: palette.gray4 }}
        android_keyboardInputMode={android_keyboardInputMode}
        keyboardBlurBehavior={keyboardBlurBehavior}
        enableDynamicSizing={enableDynamicSizing}
        animateOnMount={animateOnMount}
        activeOffsetY={activeOffsetY}
        activeOffsetX={activeOffsetX}
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
  percent65: ['65%'] as string[],
  percent55: ['55%'] as string[],
  percent50: ['50%'] as string[],
} as const;

export default BottomSheet;
