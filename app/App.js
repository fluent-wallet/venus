/**
 *
 * @format
 * @flow strict-local
 */

import {useAsync} from 'react-use';
import React, {useState} from 'react';
import type {Node} from 'react';
import * as Keychain from 'react-native-keychain';
import Authentication from './Authentication';
import './demo';

const authentication = new Authentication();

import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import database from './Database';

const useTableRecord = (tableName = 'posts') => {
  // const database = useDatabase()
  const {value} = useAsync(async () => {
    const res = await database.get(tableName).query().fetch();

    return res;
  }, []);
  return value;
};

const styles = StyleSheet.create({
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    borderColor: 'green',
    padding: 10,
  },
  button: {
    height: 40,
    width: 100,
    margin: 12,
    backgroundColor: 'green',
    color: 'red',
    padding: 10,
    textAlign: 'center',
  },
});

const App: () => Node = () => {
  const tokens = useTableRecord('token') || [];
  console.log('tokens', tokens);
  const [password, setPassword] = useState('');

  // useAsync(async () => {
  //   initDatabase();
  // });
  const setGenPassword = async () => {
    const type = await Keychain.getSupportedBiometryType();
    authentication.storePassword(password, type);
  };

  const getPassword = async () => {
    const pwt = await authentication.getGenericPassword();
    console.log('pwt', pwt);
  };

  const resetGenericPassword = async () => {
    return authentication.resetGenericPassword();
  };

  return (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View>
          <Text>Fluent Mobile</Text>
          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
          />
          <Pressable
            onPress={() => {
              console.log('password is', password);
            }}>
            <Text style={styles.button}>Confirm</Text>
          </Pressable>
          <Pressable onPress={setGenPassword}>
            <Text style={styles.button}>set password</Text>
          </Pressable>
          <Pressable onPress={getPassword}>
            <Text style={styles.button}>get password</Text>
          </Pressable>
          <Pressable onPress={resetGenericPassword}>
            <Text style={styles.button}>reset password</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
