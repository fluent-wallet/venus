import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Button, StyleSheet, Keyboard, BackHandler } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import BottomSheet, { BottomSheetView, BottomSheetTextInput, BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

const BS: React.FC = ({ children, ...props }) => {
  const navigation = useNavigation();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const indexRef = useRef(-1);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} enableTouchThrough={false} />,
    [],
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

  // callbacks
  const handleSheetChanges = useCallback((index: number) => {
    // console.log('handleSheetChanges', index);
    indexRef.current = index;
  }, []);

  const handleClose = useCallback(() => {
    console.log('handleClose', Date.now());

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, []);

  const [a, setA] = useState(0);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      onChange={(index, position, type) => {
        indexRef.current = index;
        console.log('onChange', index);
        setA(pre => pre + 1)
      }}
      onClose={() => {
        handleClose();
      }}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      
    >
      <BottomSheetView style={styles.contentContainer}>
        {/* <Button title="Back" onPress={() => navigation.goBack()} />

        <BottomSheetTextInput style={styles.textinput} /> */}
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: 500,
    padding: 24,
    backgroundColor: 'grey',
  },
  contentContainer: {
    flex: 1,
    height: 300,
    alignItems: 'center',
  },
  textinput: {
    width: '80%',
    borderWidth: 1,
    borderColor: 'black',
  },
});

export default BS;
