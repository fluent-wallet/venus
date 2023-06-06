/**
 *
 * @format
 * @flow strict-local
 */

import {useAsync} from 'react-use';
import React, {useState} from 'react';
import type {Node} from 'react';
import * as Keychain from 'react-native-keychain';

const defaultOptions = {
  service: 'com.test123',
  authenticationPromptTitle: 'authentication.auth_prompt_title',
  authenticationPrompt: {title: 'authentication.auth_prompt_desc'},
  authenticationPromptDesc: 'authentication.auth_prompt_desc',
  fingerprintPromptTitle: 'authentication.fingerprint_prompt_title',
  fingerprintPromptDesc: 'authentication.fingerprint_prompt_desc',
  fingerprintPromptCancel: 'authentication.fingerprint_prompt_cancel',
};
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
import initDatabase from './Controller/initDatabase';

const usePosts = (tableName = 'posts') => {
  // const database = useDatabase()
  const {value} = useAsync(async () => {
    const res = await database.get(tableName).query().fetch();
    // const res2 = await database
    // .get("posts")
    // .query(Q.where("id", "jl34xbkm800tbhvs"));

    // console.log("res2", res2);
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
  // const posts = usePosts() || [];
  // const comments = usePosts('comments') || [];
  // const networks = usePosts('network') || [];

  // console.log('networks', networks);
  const [password, setPassword] = useState('');
  // console.log('posts', posts);
  // console.log('comments', comments);
  //  const type = await Keychain.getSupportedBiometryType();

  useAsync(async () => {
    initDatabase();
  });
  const setGenPassword = async () => {
    const type = await Keychain.getSupportedBiometryType();
    const authOptions = {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    };
    if (type) {
      authOptions.accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET;
    }
    console.log('authOptions', authOptions);
    const res = await Keychain.setGenericPassword('test-user', '11211aaa', {
      ...defaultOptions,
      ...authOptions,
    });
    console.log('res', res);
  };

  const getPassword = async () => {
    const pwt = await Keychain.getGenericPassword(defaultOptions);
    console.log('pwt', pwt);
  };

  const resetGenericPassword = async () => {
    return Keychain.resetGenericPassword({service: defaultOptions.service});
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
