import { Q, type Query } from '@nozbe/watermelondb';
import { type Observable } from '@nozbe/watermelondb/utils/rx';
import { type Account } from '.';
import TableName from '../../TableName';
import database from '../..';

export const querySelectedAccount = () => database.get(TableName.Account).query(Q.where('selected', true)) as unknown as Query<Account>;

export const observeAccountById = (_database: typeof database, id: string) => _database.get(TableName.Account).findAndObserve(id) as Observable<Account>;

export const selectAccount = async (targetAccount: Account) =>
  database.write(async () => {
    if (targetAccount.selected) return;
    const selectedAccount = await querySelectedAccount();
    const updates = selectedAccount
      .map((account) =>
        account.prepareUpdate((_account) => {
          _account.selected = false;
        })
      )
      .concat(
        targetAccount.prepareUpdate((_account) => {
          _account.selected = true;
        })
      );
    return database.batch(...updates);
  });
