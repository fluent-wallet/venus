import { BehaviorSubject, filter } from 'rxjs';
import { WalletTransactionType } from '../Plugins/ReactInject/data/useTransaction';
import { Transaction } from 'ethers';

export const broadcastTransactionSubjectPush = new BehaviorSubject<{ txHash: string; txRaw: string; transaction: Transaction } | null>(null);

const notNull = <T>(value: T | null): value is T => value !== null;

export const broadcastTransactionSubject = broadcastTransactionSubjectPush.pipe(filter(notNull));
