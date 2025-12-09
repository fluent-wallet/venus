import { Q, type Query } from '@nozbe/watermelondb';
import database from '../..';
import { createModel, type ModelFields } from '../../helper/modelHelper';
import TableName from '../../TableName';
import type { Request } from '.';
import { RequestStatus } from './RequestType';

export type RequestParams = Omit<ModelFields<Request>, 'createdAt'>;
export function createRequest(params: RequestParams, prepareCreate: true): Request;
export function createRequest(params: RequestParams): Promise<Request>;
export function createRequest(params: RequestParams, prepareCreate?: true) {
  return createModel<Request>({ name: TableName.Request, params, prepareCreate });
}

export const queryAllRequests = () => database.get(TableName.Request).query() as unknown as Query<Request>;
export const queryPendingRequests = () => database.get(TableName.Request).query(Q.where('status', RequestStatus.Pending)) as unknown as Query<Request>;
