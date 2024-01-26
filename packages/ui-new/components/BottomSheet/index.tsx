import React, { useEffect, useCallback, useRef, type ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet_ from '@gorhom/bottom-sheet';
export { BottomSheetTextInput } from '@gorhom/bottom-sheet';

const defaultSnapPoints = [400];

interface Props extends ComponentProps<typeof BottomSheet_> {
  expand?: boolean;
}

const BottomSheet: React.FC<Props> = ({ children, expand, onChange, snapPoints = defaultSnapPoints, enablePanDownToClose = true, ...props }) => {
  const bottomSheetRef = useRef<BottomSheet_>(null);

  const handleSheetChanges = useCallback(
    (index: number) => {
      onChange?.(index);
    },
    [onChange],
  );

  useEffect(() => {
    if (expand) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
    }
  }, [expand]);

  return (
    <BottomSheet_
      index={-1}
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose={enablePanDownToClose}
      keyboardBlurBehavior="restore"
      keyboardBehavior="extend"
      {...props}
    >
      {expand && children}
    </BottomSheet_>
  );
};

const styles = StyleSheet.create({});

export default BottomSheet;
