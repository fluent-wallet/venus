import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, startWith, of } from 'rxjs';
import { dbRefresh$ } from '../../../../database';
import { observeTxById, observeFinishedTxWithAddress, observeUnfinishedTxWithAddress } from '@core/database/models/Tx/query';
import { observeSelectedAddress } from '@core/database/models/Address/query';
import { TxPayload } from '@core/database/models/TxPayload';

export const unfinishedTxsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeSelectedAddress()),
  switchMap((selectedAddress) => (selectedAddress?.[0] ? observeUnfinishedTxWithAddress(selectedAddress[0].id) : of(null)))
);

const unfinishedTxsAtom = atomWithObservable(() => unfinishedTxsObservable, { initialValue: [] });
export const useUnfinishedTxs = () => useAtomValue(unfinishedTxsAtom);

export const finishedTxsObservable = dbRefresh$.pipe(
  startWith([]),
  switchMap(() => observeSelectedAddress()),
  switchMap((selectedAddress) => (selectedAddress?.[0] ? observeFinishedTxWithAddress(selectedAddress[0].id) : of(null)))
);

const finishedTxsAtom = atomWithObservable(
  () =>
    finishedTxsObservable.pipe(
      switchMap(async (txs) => {
        if (!txs) return [];
        const payloads = await Promise.all(txs.map((tx) => tx.txPayload.fetch()));
        const txMap = new Map<string, TxPayload>();
        txs.forEach((tx, i) => {
          txMap.set(tx.id, payloads[i]);
        });
        // sort by nonce
        txs.sort((a, b) => {
          const aPayload = txMap.get(a.id)!;
          const bPayload = txMap.get(b.id)!;
          return Number(BigInt(bPayload.nonce) - BigInt(aPayload.nonce));
        });
        return txs;
      })
    ),
  { initialValue: [] }
);
export const useFinishedTxs = () => useAtomValue(finishedTxsAtom);

const payloadsAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.txPayload.observe())), { initialValue: null })
);
export const usePayloadOfTx = (txId: string) => useAtomValue(payloadsAtomFamilyOfTx(txId));

const assetAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.observeAsset())), { initialValue: null })
);
export const useAssetOfTx = (txId: string) => useAtomValue(assetAtomFamilyOfTx(txId));
