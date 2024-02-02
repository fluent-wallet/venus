import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Text from '@components/Text';

import { HomeStackName, type StackScreenProps } from '@router/configs';

const Home: React.FC<StackScreenProps<typeof HomeStackName>> = ({ navigation }) => {
  return (
    <ScrollView style={styles.container}>
      <Text>Home</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {},
});

export default Home;
