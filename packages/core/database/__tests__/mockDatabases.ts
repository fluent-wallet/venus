import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import migrations from '../migrations';
import { modelClasses } from '../models';
import schema from '../schema';

export const mockDatabase = () => {
  const adapter = new LokiJSAdapter({
    dbName: 'testdb',
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    extraLokiOptions: {
      autosave: false,
      autosaveInterval: 0,
    },
  });

  const database = new Database({
    adapter,
    modelClasses,
  });

  return database;
};
