import React, {useCallback, useRef} from 'react';
import {View, Text, Button, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {AStackName, BStackName} from '../../router/configs';
import BS from '../../components/BS';

const C = () => {
  const navigation = useNavigation();
  // renders
  return (
    <View style={styles.container}>
      <BS>
        <Text>C 🎉</Text>
        <Button title="goToA" onPress={() => navigation.navigate(AStackName)} />
        <Button title="goToB" onPress={() => navigation.navigate(BStackName)} />
      </BS>
    </View>
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
});

export default C;
