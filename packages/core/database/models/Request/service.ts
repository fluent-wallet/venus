import { type Request } from '.';
import { ModelFields, createModel } from '../../helper/modelHelper';
import TableName from '../../TableName';

type Params = ModelFields<Request>;
export function createRequest(params: Params, prepareCreate: true): Request;
export function createRequest(params: Params): Promise<Request>;
export function createRequest(params: Params, prepareCreate?: true) {
  return createModel<Request>({ name: TableName.Request, params, prepareCreate });
}
