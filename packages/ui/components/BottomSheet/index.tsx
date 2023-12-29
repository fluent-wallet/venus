import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import _BottomSheet from '@gorhom/bottom-sheet';

const BottomSheet: React.FC = () => {
  // ref
  const bottomSheetRef = useRef<_BottomSheet>(null);

  // variables
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  // renders
  return (
    <View style={styles.container}>
      <_BottomSheet ref={bottomSheetRef} index={1} snapPoints={snapPoints} onChange={handleSheetChanges}>
        <View style={styles.contentContainer}>
          <Text>Awesome 🎉</Text>
        </View>
      </_BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
});

export default BottomSheet;
