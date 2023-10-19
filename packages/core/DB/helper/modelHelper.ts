/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model, type Relation, type Query } from '@nozbe/watermelondb';
import database from '@core/DB';
import TableName from '@core/DB/TableName';

export function createModel<T extends Model>({ name, params, prepareCreate }: { name: TableName; params: object; prepareCreate?: true }) {
  const create = () => {
    const newModel = database.collections.get(name)[prepareCreate ? 'prepareCreate' : 'create']((model) => {
      const entries = Object.entries(params);
      for (const [key, value] of entries) {
        if (value !== undefined) {
          if (typeof model[key as '_raw'] === 'object') {
            if (typeof (model[key as '_raw'] as any)?.set === 'function') {
              (model[key as '_raw'] as any).set(value);
            }
          } else {
            model[key as '_raw'] = value;
          }
        }
      }
    }) as T | Promise<T>;
    return newModel;
  };

  if (prepareCreate) {
    return create();
  } else {
    return database.write(async () => await (create() as Promise<T>));
  }
}

type ExtractOwnProperties<B> = Pick<B, Exclude<keyof B, keyof Model>>;

type ExtractProperties<T> = {
  [K in keyof T as T[K] extends Relation<any> ? K : T[K] extends Query<any> ? K : never]?: T[K] extends Relation<infer U>
    ? U
    : T[K] extends Query<infer U>
    ? U
    : never;
};

type OmitProperties<T> = {
  [K in keyof T as T[K] extends Relation<any> | Query<any> ? never : K]: T[K];
};

type PickNullable<T> = {
  [P in keyof T as null extends T[P] ? P : never]: T[P];
};

type PickNotNullable<T> = {
  [P in keyof T as null extends T[P] ? never : P]: T[P];
};

type OptionalNullable<T> = {
  [K in keyof PickNullable<T>]?: Exclude<T[K], null>;
} & {
  [K in keyof PickNotNullable<T>]: T[K];
};

type NonFunctionPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type ModelFields<T extends Model> = OptionalNullable<NonFunctionProperties<OmitProperties<ExtractOwnProperties<T>>>> & ExtractProperties<T>;
