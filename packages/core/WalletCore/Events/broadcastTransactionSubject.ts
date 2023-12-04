import { BehaviorSubject, filter } from 'rxjs';
import { WalletTransactionType } from '../Plugins/ReactInject/data/useTransaction';

export const broadcastTransactionSubjectPush = new BehaviorSubject<
  (WalletTransactionType & { hash: string | null } & { gasLimit: string; gasPrice: string }) | null
>(null);

const notNull = <T>(value: T | null): value is T => value !== null;

export const broadcastTransactionSubject = broadcastTransactionSubjectPush.pipe(filter(notNull));
