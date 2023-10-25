import { withDatabase, withObservables as _withObservables, compose as _compose } from '@nozbe/watermelondb/react';
export { withDatabase, withObservables } from '@nozbe/watermelondb/react';
import { type flow } from 'lodash-es';
import _database from '.';
import TableName from './TableName';

export const compose = _compose as typeof flow;
export type Database = typeof _database;

export function withObservablesFromDB(observeModels: Array<TableName>) {
  return compose(
    withDatabase,
    _withObservables([], ({ database }: { database: Database }) =>
      Object.fromEntries(observeModels.map((model) => [convertToCamelCase(model), database.collections.get(model).query().observe()]))
    )
  ) as ReturnType<typeof _withObservables>;
}

function convertToCamelCase(str: string) {
  return str.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}