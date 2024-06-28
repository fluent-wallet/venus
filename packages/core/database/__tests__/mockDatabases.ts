import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import migrations from '../migrations';
import schema from '../schema';

import { modelClasses } from '../index';

export const mockDatabase = () => {
  const adapter = new LokiJSAdapter({
    dbName: 'testdb',
    schema,
    migrations,
  });

  const database = new Database({
    adapter,
    modelClasses,
  });

  return database;
};
