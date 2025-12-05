import { Q, type Query } from '@nozbe/watermelondb';
import database from '../..';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { App } from '.';

export type AppParams = ModelFields<App>;
export function createApp(params: AppParams, prepareCreate: true): App;
export function createApp(params: AppParams): Promise<App>;
export function createApp(params: AppParams, prepareCreate?: true) {
  return createModel<App>({ name: TableName.App, params, prepareCreate });
}

export const queryAppByIdentity = (identity: string) => database.get(TableName.App).query(Q.where('identity', identity)) as unknown as Query<App> | null;
export const queryAppByName = (appName: string) => database.get(TableName.App).query(Q.where('name', appName)) as unknown as Query<App> | null;
