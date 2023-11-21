import { injectable } from 'inversify';
import { type Account } from '../../database/models/Account';
import { querySelectedAccount } from '../../database/models/Account/query';
import database from '../../database';
import TableName from '../../database/TableName';

@injectable()
export class AccountMethod {
  async updateAccountNickName({ account, nickname }: { account: Account; nickname: string }) {
    return account.updateName(nickname);
  }

  async changeAccountHidden({ account, hidden }: { account: Account; hidden: boolean }) {
    return account.changeHidden(hidden);
  }

  prepareChangeAccountHidden({ account, hidden }: { account: Account; hidden: boolean }) {
    return account.prepareChangeHidden(hidden);
  }

  async selectAccount(targetAccountOrId: Account | string) {
    const targetAccount =
      typeof targetAccountOrId === 'string' ? ((await database.get(TableName.Account).find(targetAccountOrId)) as Account) : targetAccountOrId;
    if (!targetAccount) throw new Error('Account not found.');

    return database.write(async () => {
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
  }
}
