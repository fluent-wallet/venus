import { Subject } from 'rxjs';
import type { App } from '../../database/models/App';
import type { Request } from '../../database/models/Request';

export interface RequestSubject {
  resolve: (...args: any[]) => Promise<void>;
  reject: (...args: any[]) => Promise<void>;
  payload: any;
  request: {
    id: Request['id'];
    type: Request['type'];
    value: Request['value'];
    app: App;
  };
}

export const requestSubjectsMap = new Map<string, RequestSubject>();
export const newestRequestSubject = new Subject<RequestSubject>();
