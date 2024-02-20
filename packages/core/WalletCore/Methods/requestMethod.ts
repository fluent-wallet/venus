import { injectable } from 'inversify';
import { RequestStatus } from '../../database/models/Request/RequestType';
import { createRequest as _createRequest, queryPendingRequests, type RequestParams } from '../../database/models/Request/query';
import database from '../../database';
import { newestRequestSubject, requestSubjectsMap, type RequestSubject } from '../Events/requestSubject';

const requestConfig: {
  rejectPrevRequest: boolean;
} = {
  rejectPrevRequest: true,
} as const;

let newestRequestSubjectObj: RequestSubject | null = null;

@injectable()
export class RequestMethod {
  createRequest = async (
    params: Omit<RequestParams, 'status'> & { resolve?: (...args: any[]) => Promise<void>; reject?: (...args: any[]) => Promise<void>; payload?: any },
  ) => {
    const request = await _createRequest({ ...params, status: RequestStatus.Pending });

    const _finally = () => {
      // clear work
      requestSubjectsMap.delete(request.id);
      if (newestRequestSubjectObj === requestSubjectObj) {
        newestRequestSubjectObj = null;
      }
    };
    const requestSubjectObj: RequestSubject = {
      resolve: async (...args) => {
        if (params.resolve) {
          await params?.resolve(...args);
        }
        request.updateStatus(RequestStatus.Resolved);
        _finally();
      },
      reject: async (...args) => {
        if (params.reject) {
          await params.reject(...args);
        }
        request.updateStatus(RequestStatus.Rejected);
        _finally();
      },
      payload: params.payload,
      request: {
        id: request.id,
        type: request.type,
        value: request.value,
        app: params.app!,
      },
    };

    requestSubjectsMap.set(request.id, requestSubjectObj);
    newestRequestSubject.next(requestSubjectObj);
    newestRequestSubjectObj = requestSubjectObj;
  };

  getRequestById = (id: string) => {
    return requestSubjectsMap.get(id);
  };

  rejectAllPendingRequests = async () => {
    const pendingRequests = await queryPendingRequests();
    pendingRequests.forEach((request) => {
      if (requestSubjectsMap.has(request.id)) {
        requestSubjectsMap.get(request.id)?.reject('Request rejected');
        requestSubjectsMap.delete(request.id);
      }
    });
    await database.write(async () => {
      await database.batch(pendingRequests.map((request) => request.prepareUpdateStatus(RequestStatus.Rejected)));
    });
  };
}
