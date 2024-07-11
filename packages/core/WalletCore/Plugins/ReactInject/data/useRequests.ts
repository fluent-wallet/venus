import { atom, useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { startWith, switchMap } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { RequestStatus } from '../../../../database/models/Request/RequestType';
import { queryAllRequests } from '../../../../database/models/Request/query';

export const requestsObservable = dbRefresh$.pipe(
  startWith(null),
  switchMap(() => queryAllRequests().observe()),
);
const requestsAtom = atomWithObservable(() => requestsObservable, { initialValue: [] });
const pendingRequestsAtom = atom((get) => get(requestsAtom).filter((request) => request.status === RequestStatus.Pending));

export const useAllRequests = () => useAtomValue(requestsAtom);
export const usePendingRequests = () => useAtomValue(pendingRequestsAtom);
