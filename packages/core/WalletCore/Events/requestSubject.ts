import { Subject } from 'rxjs';
import { type Request } from '../../database/models/Request';
import { type App } from '../../database/models/App';

export interface RequestSubject {
  resolve: (value: boolean | PromiseLike<boolean>) => void;
  reject: (reason: any) => void;
  promise: Promise<boolean>;
  request: {
    type: Request['type'];
    value: Request['value'];
    app: App;
  };
}

export const requestSubjectsMap = new Map<string, RequestSubject>();
export const newestRequestSubject = new Subject<RequestSubject>();
