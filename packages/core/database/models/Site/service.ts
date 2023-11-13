import { type Site } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Site>;
export function createSite(params: Params, prepareCreate: true): Site;
export function createSite(params: Params): Promise<Site>;
export function createSite(params: Params, prepareCreate?: true) {
  return createModel<Site>({ name: TableName.Site, params, prepareCreate });
}
