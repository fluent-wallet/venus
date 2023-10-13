import { type Model } from '@nozbe/watermelondb';
import database from '@core/DB';
import TableName from '@core/DB/TableName';

export function createModel<T extends Model>({ name, params, prepareCreate }: { name: TableName; params: object; prepareCreate?: true }) {
  const newModel = database.collections.get(name)[prepareCreate ? 'prepareCreate' : 'create']((model) => {
    const entries = Object.entries(params);
    for (const [key, value] of entries) {
      if (value !== undefined) {
        model[key as '_raw'] = value;
      }
    }
  }) as T | Promise<T>;
  return newModel;
}
