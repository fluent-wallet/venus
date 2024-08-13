import type { Asset } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { observeTxById, observeTxsWithAddress } from '../../../../database/models/Tx/query';
import type { TxPayload } from '../../../../database/models/TxPayload';
import { formatTxData } from '../../../../utils/tx';
import { accountsManageObservable } from './useAccountsManage';
import { currentAddressObservable } from './useCurrentAddress';
import { getAtom } from '../nexus';
import { PENDING_TX_STATUSES, FINISHED_IN_ACTIVITY_TX_STATUSES, EXECUTED_TX_STATUSES, TxStatus, PENDING_COUNT_STATUSES } from '@core/database/models/Tx/type';
import { getWalletConfig } from './useWalletConfig';

const uniqSortByNonce = async (_txs: Tx[] | null) => {
  if (!_txs) return [];
  const payloads = await Promise.all(_txs.map((tx) => tx.txPayload.fetch()));
  const payloadMap = new Map<string, TxPayload>();
  const nonceMap = new Map<number, Tx>();
  // uniq by nonce
  _txs.forEach((tx, i) => {
    const prevTx = nonceMap.get(payloads[i].nonce ?? 0);
    if (!prevTx) {
      // first tx of payloads[i].nonce
      nonceMap.set(payloads[i].nonce ?? 0, tx);
      payloadMap.set(tx.id, payloads[i]);
    } else if (EXECUTED_TX_STATUSES.includes(tx.status)) {
      // already has tx of payloads[i].nonce
      // and this tx is executed, replace prevTx
      nonceMap.set(payloads[i].nonce ?? 0, tx);
      payloadMap.delete(prevTx.id);
      payloadMap.set(tx.id, payloads[i]);
    }
    return true;
  });
  const txs = Array.from(nonceMap.values());
  // sort by nonce
  txs.sort((a, b) => {
    const aPayload = payloadMap.get(a.id)!;
    const bPayload = payloadMap.get(b.id)!;
    return Number(BigInt(bPayload.nonce ?? 0) - BigInt(aPayload.nonce ?? 0));
  });
  return txs;
};

const activityListObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) =>
    currentAddress
      ? observeTxsWithAddress(currentAddress.id, {
          notInStatuses: [TxStatus.SEND_FAILED],
        })
      : of([]),
  ),
);
const activityListAtom = atomWithObservable(() => activityListObservable.pipe(switchMap(uniqSortByNonce)), { initialValue: [] });

export const useUnfinishedTxs = () => {
  const activityList = useAtomValue(activityListAtom);
  return activityList.filter((tx) => PENDING_TX_STATUSES.includes(tx.status));
};
export const useFinishedTxs = () => {
  const activityList = useAtomValue(activityListAtom);
  return activityList.filter((tx) => FINISHED_IN_ACTIVITY_TX_STATUSES.includes(tx.status));
};

export enum RecentlyType {
  Account = 'Account',
  Contract = 'Contract',
  Recently = 'Recently',
}
export const recentlyAddressObservable = combineLatest([activityListObservable, accountsManageObservable]).pipe(
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
    const allAccounts = latestAddresses.accountsManage?.flatMap((item) => item.data);
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
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((txs) => txs[0].txPayload.observe())), { initialValue: null }),
);
export const usePayloadOfTx = (txId: string) => useAtomValue(payloadsAtomFamilyOfTx(txId));

const assetAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(() => observeTxById(txId).pipe(switchMap((txs) => txs[0].observeAsset())), { initialValue: null }),
);
export const useAssetOfTx = (txId: string) => useAtomValue(assetAtomFamilyOfTx(txId));

const networkAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(
    () =>
      observeTxById(txId).pipe(
        switchMap((txs) => txs[0].address.observe()),
        switchMap((address) => address.network.observe()),
      ),
    { initialValue: null },
  ),
);
export const useNetworkOfTx = (txId: string) => useAtomValue(networkAtomFamilyOfTx(txId));

const accountAtomFamilyOfTx = atomFamily((txId: string) =>
  atomWithObservable(
    () =>
      observeTxById(txId).pipe(
        switchMap((txs) => txs[0].address.observe()),
        switchMap((address) => address.account.observe()),
      ),
    { initialValue: null },
  ),
);
export const useAccountOfTx = (txId: string) => useAtomValue(accountAtomFamilyOfTx(txId));

const txsOfPendingCountObservable = currentAddressObservable.pipe(
  switchMap((currentAddress) =>
    currentAddress
      ? observeTxsWithAddress(currentAddress.id, {
          inStatuses: PENDING_COUNT_STATUSES,
        })
      : of([]),
  ),
);
const txsOfPendingCountAtom = atomWithObservable(() => txsOfPendingCountObservable.pipe(switchMap(uniqSortByNonce)), { initialValue: [] });

const getPendingTxs = () => getAtom(txsOfPendingCountAtom);
export const isPendingTxsFull = () => {
  const pendingTxs = getPendingTxs();
  const walletConfig = getWalletConfig();
  return pendingTxs && pendingTxs.length >= walletConfig.pendingCountLimit;
};
