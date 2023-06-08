import {getNthAccountOfHDKey} from '@fluent-wallet/hdkey';

import database from '../Database';
import {getDuplicatesByContent} from '../utils/validateDuplicateRecords';
import {getNetworks, getAccountGroups} from '../Query';
import Encrypt from '../utils/encrypt';
const encrypt = new Encrypt();

class Vault {
  constructor({password, mnemonic, pk, device = 'VenusMobile'}) {
    this.password = password;
    this.mnemonic = mnemonic;
    this.pk = pk;
    this.device = device;
  }

  _generateAccountsByMnemonic(networksArr, nth = 0) {
    return networksArr.map(async ({hdPath}) => {
      const hdPathValue = await hdPath.fetch().value;
      const ret = getNthAccountOfHDKey({
        mnemonic: this.mnemonic,
        hdPath: hdPathValue,
        nth,
      });
      return ret;
    });
  }

  _preCreateVault(encryptData) {
    return database.get('vault').prepareCreate(r => {
      r.type = this.mnemonic ? 'hd' : 'pk';
      r.data = encryptData;
      r.device = this.device;
    });
  }
  _preCreateAccountGroup(vault, groups) {
    return database.get('account_group').prepareCreate(r => {
      r.nickname = `group-${groups.length + 1}`;
      r.hidden = false;
      r.vault.set(vault);
    });
  }

  _preCreateAccount({
    accountGroup,
    groups,
    accountIndex,
    hidden = false,
    selected = false,
  }) {
    return database.get('account').prepareCreate(r => {
      r.accountGroup.set(accountGroup);
      r.index = accountIndex;
      r.nickname = `group-${groups.length + 1}-${accountIndex}`;
      r.hidden = hidden;
      r.selected = selected;
    });
  }

  _preCreateAddress({account, network, value, hex, pk, nativeBalance = '0x0'}) {
    return database.get('address').prepareCreate(r => {
      r.account.set(account);
      r.network.set(network);
      r.value = value;
      r.hex = hex;
      r.pk = pk;
      r.native_balance = nativeBalance;
    });
  }
  async addVault() {
    // TODO: not support pub hw and cfxOnly for now
    const encryptData = await encrypt.encrypt(this.password, {
      data: this.mnemonic || this.pk,
    });
    const duplicates = await getDuplicatesByContent(
      'vault',
      'data',
      encryptData,
    );

    if (duplicates.length) {
      throw new Error('duplicate mnemonic or pk!');
    }
    const networksArr = await getNetworks();
    const hdRets = await Promise.all(
      this._generateAccountsByMnemonic(networksArr),
    );

    console.log('hdRets', hdRets);

    console.log('networksArr', networksArr);
    const groups = await getAccountGroups();

    const vaultTableInstance = this._preCreateVault(encryptData);
    const accountGroupTableInstance = this._preCreateAccountGroup(
      vaultTableInstance,
      groups,
    );

    const accountTableInstance = this._preCreateAccount({
      accountGroup: accountGroupTableInstance,
      groups,
      accountIndex: 0,
    });
    // TODO 根据networkType ===cfx 判断 生成value 地址.加密私钥
    const addressTableInstance = hdRets.map((r, index) => {
      return this._preCreateAddress({
        account: accountTableInstance,
        network: networksArr[index],
      });
    });
    await database.write(async () => {
      await database.batch(vaultTableInstance);
    });
  }
}

export default Vault;
