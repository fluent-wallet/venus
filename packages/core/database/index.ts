import { Database as _Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Subject } from 'rxjs';
import migrations from './migrations';
import { modelClasses } from './models';
import schema from './schema';
export const dbRefresh$ = new Subject();
const adapter = new SQLiteAdapter({
  dbName: 'venus_database2',
  schema,
  migrations,
  // RN not support synchronous mode yet(ps: jsi === true means enable synchronous mode).see below:
  // https://github.com/facebook/react-native/issues/26705
  // https://github.com/Nozbe/WatermelonDB/issues/813
  // This bug may only appear in debug mode.We will continue to watch...
  jsi: false, // jsi: Platform.OS === 'ios',
});

const database = new _Database({
  adapter,
  modelClasses,
});

export type Database = typeof database;
export default database;
