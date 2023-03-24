// import {Platform} from 'react-native';
import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './model/schema';
import migrations from './model/migrations';
import {Post, Comment} from './model/post';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // RN not support synchronous mode yet(ps: jsi === true means enable synchronous mode).see below:
  // https://github.com/facebook/react-native/issues/26705
  // https://github.com/Nozbe/WatermelonDB/issues/813
  // This bug may only appear in debug mode.We will continue to watch...
  jsi: false, // jsi: Platform.OS === 'ios',
  onSetUpError: error => {},
});

const database = new Database({
  adapter,
  modelClasses: [Post, Comment],
});

export default database;
