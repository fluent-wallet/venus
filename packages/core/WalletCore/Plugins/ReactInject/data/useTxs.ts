import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { switchMap, of, combineLatest, map } from 'rxjs';
import {
  observeTxById,
  observeFinishedTxWithAddress,
  observeUnfinishedTxWithAddress,
  observeRecentlyTxWithAddress,
} from '../../../../database/models/Tx/query';
import { currentAddressObservable } from './useCurrentAddress';
import { accountsManageObservable } from './useAccountsManage';
import { TxPayload } from '../../../../database/models/TxPayload';
import { formatTxData } from '../../../../utils/tx';
import { Asset } from '@core/database/models/Asset';
import { Tx } from '@core/database/models/Tx';

const recentlyTxsObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeRecentlyTxWithAddress(currentAddress.id) : of([]))),
);

export const unfinishedTxsObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeUnfinishedTxWithAddress(currentAddress.id) : of(null))),
);

const unfinishedTxsAtom = atomWithObservable(() => unfinishedTxsObservable, { initialValue: [] });
export const useUnfinishedTxs = () => useAtomValue(unfinishedTxsAtom);

export const finishedTxsObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) => (currentAddress ? observeFinishedTxWithAddress(currentAddress.id) : of(null))),
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
          return Number(BigInt(bPayload.nonce ?? 0) - BigInt(aPayload.nonce ?? 0));
        });
        return txs;
      }),
    ),
  { initialValue: [] },
);
export const useFinishedTxs = () => useAtomValue(finishedTxsAtom);

export enum RecentlyType {
  Account = 'Account',
  Contract = 'Contract',
  Recently = 'Recently',
}
export const recentlyAddressObservable = combineLatest([recentlyTxsObservable, accountsManageObservable]).pipe(
  switchMap(([txs, accountsManage]) =>
    Promise.all([txs, Promise.all(txs.filter(Boolean).map((tx) => tx!.txPayload)), Promise.all(txs.filter(Boolean).map((tx) => tx!.asset)), accountsManage]),
  ),
  map(([txs, txPayloads, txAssets, accountsManage]) => {
    const txMap = new Map<string, Tx>();
    const assetMap = new Map<string, Asset>();
    txPayloads.forEach((p, i) => {
      txMap.set(p.id, txs[i]);
      assetMap.set(p.id, txAssets[i]);
    });
    return [
      txPayloads
        .sort((a, b) => Number((b.nonce ?? 0) - (a.nonce ?? 0)))
        .map((txPayload) => formatTxData(txMap.get(txPayload.id)!, txPayload, assetMap.get(txPayload.id)!))
        .filter((formatedTxData) => formatedTxData.isTransfer),
      accountsManage,
    ] as const;
  }),
  map(([formatedTxData, accountsManage]) => {
    const toAddress = Array.from(new Set(formatedTxData.map((txPayload) => txPayload?.to))).filter((addressValue) => !!addressValue) as Array<string>;
    const fromAddress = Array.from(new Set(formatedTxData.map((txPayload) => txPayload?.from))).filter((addressValue) => !!addressValue) as Array<string>;
    return {
      from: fromAddress.map((addressValue) => ({ addressValue, source: 'from' })),
      to: toAddress.map((addressValue) => ({ addressValue, source: 'to' })),
      accountsManage,
    };
  }),
  map((latestAddresses) => {
    const allAccounts = latestAddresses.accountsManage?.map((item) => item.data).flat();
    return latestAddresses.to.map(({ addressValue, source }) => {
      const isMyAccount = allAccounts.find((account) => account.addressValue === addressValue);
      return {
        addressValue,
        nickname: isMyAccount?.nickname,
        type: isMyAccount ? RecentlyType.Account : (RecentlyType.Recently as RecentlyType),
        source,
      };
    });
  }),
);

const recentlyAddressAtom = atomWithObservable(() => recentlyAddressObservable, { initialValue: [] });
export const useRecentlyAddress = () => useAtomValue(recentlyAddressAtom);

const payloadsAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.txPayload.observe())), { initialValue: null }),
);
export const usePayloadOfTx = (txId: string) => useAtomValue(payloadsAtomFamilyOfTx(txId));

const assetAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((tx) => tx.observeAsset())), { initialValue: null }),
);
export const useAssetOfTx = (txId: string) => useAtomValue(assetAtomFamilyOfTx(txId));
