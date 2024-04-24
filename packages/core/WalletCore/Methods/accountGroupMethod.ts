import { injectable } from 'inversify';
import { type AccountGroup } from '../../database/models/AccountGroup';

@injectable()
export class AccountGroupMethod {
  async updateAccountGroupNickName({ accountGroup, nickname }: { accountGroup: AccountGroup; nickname: string }) {
    return accountGroup.updateName(nickname);
  }

  async changeAccountGroupHidden({ accountGroup, hidden }: { accountGroup: AccountGroup; hidden: boolean }) {
    return accountGroup.changeHidden(hidden);
  }

  async getAccountGroupLastAccountIndex(accountGroup: AccountGroup) {
    return accountGroup.getLastAccountIndex();
  }

  async getAccountGroupAccountByIndex({ accountGroup, index }: { accountGroup: AccountGroup; index: number }) {
    return accountGroup.getAccountByIndex(index);
  }

  async getAccountGroup(accountGroup: AccountGroup) {
    return accountGroup;
  }
}
