import { useCallback, useRef, forwardRef, type ComponentProps } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BottomSheet_, { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import composeRef from '@cfx-kit/react-utils/dist/composeRef';
export * from '@gorhom/bottom-sheet';
export { default as BottomSheetMethods } from '@gorhom/bottom-sheet';

interface Props extends ComponentProps<typeof BottomSheet_> {
  backDropPressBehavior?: 'none' | 'close' | 'collapse' | number;
  handlePressBackdrop?: () => void;
}
const BottomSheet = forwardRef<BottomSheet_, Props>(
  (
    { children, enablePanDownToClose = true, keyboardBlurBehavior = 'restore', backDropPressBehavior = 'close', handlePressBackdrop, ...props },
    _forwardRef,
  ) => {
    const indexRef = useRef(-1);
    const bottomSheetRef = useRef<BottomSheet_>(null);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior={backDropPressBehavior} onPress={handlePressBackdrop} />
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

    return (
      <BottomSheet_
        ref={composeRef([_forwardRef!, bottomSheetRef])}
        index={-1}
        onChange={(index) => (indexRef.current = index)}
        enablePanDownToClose={enablePanDownToClose}
        keyboardBlurBehavior={keyboardBlurBehavior}
        backdropComponent={renderBackdrop}
        {...props}
      >
        {children}
      </BottomSheet_>
    );
  },
);

export default BottomSheet;
