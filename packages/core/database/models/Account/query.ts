import { Q, type Query } from '@nozbe/watermelondb';
import { type Observable } from 'rxjs';
import { memoize } from 'lodash-es';
import { type Account } from '.';
import TableName from '../../TableName';
import database from '../..';

export const querySelectedAccount = () => database.get(TableName.Account).query(Q.where('selected', true)) as unknown as Query<Account>;

export const observeAccountById = memoize((accountId: string) => database.get(TableName.Account).findAndObserve(accountId) as Observable<Account>);
