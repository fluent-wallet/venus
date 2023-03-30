/**
 *
 * @format
 * @flow strict-local
 */

import {useAsync} from 'react-use';
import React, {useState} from 'react';
import type {Node} from 'react';

import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  TextInput,
  Pressable,
  StyleSheet,
} from 'react-native';
import database from './database';

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
  const posts = usePosts() || [];
  const comments = usePosts('comments') || [];

  const [password, setPassword] = useState('');
  console.log('posts', posts);
  console.log('comments', comments);

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
