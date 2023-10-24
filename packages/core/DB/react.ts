import { withDatabase, withObservables as _withObservables } from '@nozbe/watermelondb/react';
export { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { flow } from 'lodash-es';
import _database from '.';
import TableName from './TableName';
export { flow as compose } from 'lodash-es';

export type Database = typeof _database;

export function withObservablesFromDB(observeModels: Array<TableName>) {
  return flow(
    withDatabase,
    _withObservables([], ({ database }: { database: Database }) =>
      Object.fromEntries(observeModels.map((model) => [model, database.collections.get(model).query().observe()]))
    )
  ) as ReturnType<typeof _withObservables>;
}
