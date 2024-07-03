/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Model, Query, Relation } from '@nozbe/watermelondb';
import database from '../index';
import type TableName from '../TableName';

export function createModel<T extends Model>({ name, params, prepareCreate }: { name: TableName; params: object; prepareCreate?: true }) {
  const create = () => {
    const newModel = database.collections.get(name)[prepareCreate ? 'prepareCreate' : 'create']((model) => {
      const entries = Object.entries(params);
      for (const [key, value] of entries) {
        if (value !== undefined) {
          if (typeof model[key as '_raw'] === 'object' && model[key as '_raw'] !== null && typeof (model[key as '_raw'] as any)?.set === 'function') {
            (model[key as '_raw'] as any).set(value);
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
  }
  return database.write(async () => await (create() as Promise<T>));
}

type ExtractOwnProperties<B> = Pick<B, Exclude<keyof B, keyof Model>>;

type ExtractProperties<T> = {
  [K in keyof T as Exclude<T[K], null | undefined> extends Relation<any> ? K : T[K] extends Query<any> ? K : never]?: Exclude<
    T[K],
    null | undefined
  > extends Relation<infer U>
    ? U
    : T[K] extends Query<infer U>
      ? U
      : never;
};

type OmitProperties<T> = {
  [K in keyof T as Exclude<T[K], null | undefined> extends Relation<any> | Query<any> ? never : K]: T[K];
};

type PickNullable<T> = {
  [P in keyof T as null extends T[P] ? P : never]: T[P];
};

type PickNotNullable<T> = {
  [P in keyof T as null extends T[P] ? never : P]: T[P];
};

type OptionalNullable<T> = {
  [K in keyof PickNullable<T>]?: T[K];
} & {
  [K in keyof PickNotNullable<T>]: T[K];
};

type NonFunctionPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type ModelFields<T extends Model> = OptionalNullable<NonFunctionProperties<OmitProperties<ExtractOwnProperties<T>>>> & ExtractProperties<T>;
