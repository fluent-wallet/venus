import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, of } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { observeTxById, observeFinishedTxs, observeUnfinishedTx } from '@core/database/models/Tx/query';

export const unfinishedTxsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeUnfinishedTx())
);

const unfinishedTxsAtom = atomWithObservable(() => unfinishedTxsObservable, { initialValue: [] });
export const useUnfinishedTxs = () => useAtomValue(unfinishedTxsAtom);

export const txsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeFinishedTxs())
);

const finishedTxsAtom = atomWithObservable(() => txsObservable, { initialValue: [] });
export const useFinishedTxs = () => useAtomValue(finishedTxsAtom);

const payloadsAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.txPayload.observe())), { initialValue: null })
);
export const usePayloadOfTx = (txId: string) => useAtomValue(payloadsAtomFamilyOfTx(txId));

const assetAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => (tx.asset.id ? tx.asset.observe() : of(null)))), { initialValue: null })
);
export const useAssetOfTx = (txId: string) => useAtomValue(assetAtomFamilyOfTx(txId));
