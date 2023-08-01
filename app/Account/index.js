import database from '../Database';
import Encrypt from '../utils/encrypt';
import {
  generateAddressesByMnemonic,
  preCreateAccount,
  preCreateAddress,
} from '../utils';
import {getAccountGroupVault, getNetworks, getAccountGroups} from '../Query';
const encrypt = new Encrypt();

class Account {
  updateAccountGroupName({nickname, accountGroupId}) {
    return database.write(async () => {
      const accountGroupRecord = await database
        .get('account_group')
        .find(accountGroupId);
      await accountGroupRecord.update(() => {
        accountGroupRecord.nickname = nickname;
      });
    });
  }
  updateAccountName({nickname, accountId}) {
    return database.write(async () => {
      const accountTableRecord = await database.get('account').find(accountId);
      await accountTableRecord.update(() => {
        accountTableRecord.nickname = nickname;
      });
    });
  }
  async getMnemonic({accountGroupId, password}) {
    const vault = await getAccountGroupVault(accountGroupId);
    const {data: mnemonic} = await encrypt.decrypt(password, vault.data);
    return {mnemonic, vault};
  }
  async addAccount({accountGroupId, password}) {
    const accountGroupRecord = await database
      .get('account_group')
      .find(accountGroupId);
    const network = await getNetworks();
    const groups = await getAccountGroups();
    const {mnemonic} = await this.getMnemonic({
      accountGroupId,
      password,
    });
    const account = await accountGroupRecord.account.fetch();
    const nth = account[account.length - 1].index + 1;
    const hdRets = await Promise.all(
      generateAddressesByMnemonic({
        networksArr: network,
        mnemonic,
        password,
        nth,
      }),
    );
    const accountTableInstance = preCreateAccount({
      accountGroup: accountGroupRecord,
      groups,
      accountIndex: nth,
    });

    const addressTableInstance = hdRets.map(({address, encryptPk}, index) => {
      return preCreateAddress({
        account: accountTableInstance,
        network: network[index],
        hex: address,
        pk: encryptPk,
      });
    });
    await database.write(async () => {
      await database.batch(accountTableInstance, ...addressTableInstance);
    });
  }
  async deleteAccount() {}
}

export default Account;
