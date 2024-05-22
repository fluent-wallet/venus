import React, {useCallback, useRef} from 'react';
import {View, Text, Button, StyleSheet} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import BottomSheet, {BottomSheetView} from '@gorhom/bottom-sheet';
import {AStackName, CStackName} from '../../router/configs';
import BS from '../../components/BS';

const B = () => {
  const navigation = useNavigation();

  // renders
  return (
    <View style={styles.container}>
      <BS>
        <Text>B 🎉</Text>
        <Button title="goToA" onPress={() => navigation.navigate(AStackName)} />
        <Button title="goToC" onPress={() => navigation.navigate(CStackName)} />
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

export default B;
