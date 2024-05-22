import React from 'react';
import { SafeAreaView, View, StyleSheet, Button } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AStackName, BStackName, CStackName } from '../../router/configs';

function App(): React.JSX.Element {
  const navigation = useNavigation();
  return (
    <View style={styles.view}>
      <Button title="AAAAA" onPress={() => navigation.navigate(AStackName)} />
      <Button title="BBBBB" onPress={() => navigation.navigate(BStackName)} />
      <Button title="CCCCC" onPress={() => navigation.navigate(CStackName)} />
    </View>
  );
}

const styles = StyleSheet.create({
  view: {
    marginTop: 32,
    paddingHorizontal: 24,
    height: 500,
    backgroundColor: 'red',
  },
});

export default App;
