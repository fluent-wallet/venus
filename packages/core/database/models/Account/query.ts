import { Q, type Query } from '@nozbe/watermelondb';
import { memoize } from 'lodash-es';
import type { Observable } from 'rxjs';
import database from '../..';
import TableName from '../../TableName';
import type { Account } from '.';

export const querySelectedAccount = () => database.get(TableName.Account).query(Q.where('selected', true)) as unknown as Query<Account>;

export const observeAccountById = memoize((accountId: string) => database.get(TableName.Account).findAndObserve(accountId) as Observable<Account>);

export const queryAccountById = (accountId: string) => database.get(TableName.Account).find(accountId) as Promise<Account>;
