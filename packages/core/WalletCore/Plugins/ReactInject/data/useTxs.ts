import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, of } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { observeTxById, observeFinishedTxWithAddress, observeUnfinishedTxWithAddress } from '@core/database/models/Tx/query';
import { observeSelectedAddress } from '@core/database/models/Address/query';

export const unfinishedTxsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeSelectedAddress()),
  switchMap(selectedAddress => selectedAddress?.[0] ? observeUnfinishedTxWithAddress(selectedAddress[0].id) : of(null)),
);

const unfinishedTxsAtom = atomWithObservable(() => unfinishedTxsObservable, { initialValue: [] });
export const useUnfinishedTxs = () => useAtomValue(unfinishedTxsAtom);

export const finishedTxsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeSelectedAddress()),
  switchMap(selectedAddress => selectedAddress?.[0] ? observeFinishedTxWithAddress(selectedAddress[0].id) : of(null)),
);

const finishedTxsAtom = atomWithObservable(() => finishedTxsObservable, { initialValue: [] });
export const useFinishedTxs = () => useAtomValue(finishedTxsAtom);

const payloadsAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.txPayload.observe())), { initialValue: null })
);
export const usePayloadOfTx = (txId: string) => useAtomValue(payloadsAtomFamilyOfTx(txId));

const assetAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => (tx.asset.id ? tx.asset.observe() : of(null)))), { initialValue: null })
);
export const useAssetOfTx = (txId: string) => useAtomValue(assetAtomFamilyOfTx(txId));
