import { BehaviorSubject, filter } from 'rxjs';
import { ITxEvm } from './../Plugins/Transaction/types';
import { type WalletTransactionType } from '../Plugins/Transaction/types';

export interface TransactionSubjectValue {
  txHash: string;
  txRaw: string;
  tx: ITxEvm;
  extraParams: Pick<WalletTransactionType, 'assetType' | 'contractAddress' | 'to'> & {
    sendAt: Date;
    epochHeight?: string | null;
  };
}

export const broadcastTransactionSubjectPush = new BehaviorSubject<TransactionSubjectValue | null>(null);

const notNull = <T>(value: T | null): value is T => value !== null;

export const broadcastTransactionSubject = broadcastTransactionSubjectPush.pipe(filter(notNull));
