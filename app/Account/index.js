import database from '../Database';
import Encrypt from '../utils/encrypt';
import {
  generateAddressesByMnemonic,
  preCreateAccount,
  preCreateAddress,
} from '../utils';
import {getAccountGroupVault, getNetworks} from '../Query';
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
    // console.log('mnemonic', mnemonic);
    return {mnemonic, vault};
  }
  async getPrivateKey({addressId, password}) {
    const addressRecord = await database.get('address').find(addressId);
    const {pk} = await encrypt.decrypt(password, addressRecord.pk);
    // console.log('pk', pk);
    return pk;
  }

  async addAccount({accountGroupId, password}) {
    const accountGroupRecord = await database
      .get('account_group')
      .find(accountGroupId);
    const network = await getNetworks();
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
      groupName: accountGroupRecord.nickname,
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
  async switchAccountHideStatus({accountGroupId, accountId, hidden = true}) {
    const accountGroupRecord = await database
      .get('account_group')
      .find(accountGroupId);
    const account = await accountGroupRecord.account.fetch();
    const showAccount = account.filter(a => !a.hidden);
    if (showAccount.length <= 1 && hidden) {
      throw Error('Keep at least one account');
    }
    return database.write(async () => {
      const accountTableRecord = await database.get('account').find(accountId);
      await accountTableRecord.update(() => {
        accountTableRecord.hidden = hidden;
      });
    });
  }
}

export default Account;
