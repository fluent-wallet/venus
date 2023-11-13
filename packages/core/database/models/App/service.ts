import { type App } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<App>;
export function createApp(params: Params, prepareCreate: true): App;
export function createApp(params: Params): Promise<App>;
export function createApp(params: Params, prepareCreate?: true) {
  return createModel<App>({ name: TableName.App, params, prepareCreate });
}
