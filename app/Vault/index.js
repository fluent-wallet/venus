import {getNthAccountOfHDKey} from '@fluent-wallet/hdkey';
import {toAccountAddress, fromPrivate} from '@fluent-wallet/account';
import {encode} from '@fluent-wallet/base32-address';
import database from '../Database';
import {validateDuplicateVault} from '../utils';
import Encrypt from '../utils/encrypt';

const encrypt = new Encrypt();

class Vault {
  constructor({
    password,
    mnemonic,
    pk,
    device = 'VenusMobile',
    networks,
    accountGroups,
  }) {
    this.password = password;
    this.mnemonic = mnemonic;
    this.pk = pk;
    this.device = device;
    this.networks = networks;
    this.accountGroups = accountGroups;
  }

  _generateAddressesByMnemonic(networksArr, nth = 0) {
    return networksArr.map(async ({hdPath}) => {
      const hdPathValue = await hdPath.fetch().value;
      const ret = await getNthAccountOfHDKey({
        mnemonic: this.mnemonic,
        hdPath: hdPathValue,
        nth,
      });
      ret.encryptPk = await encrypt.encrypt(this.password, {
        pk: ret.privateKey,
      });
      return ret;
    });
  }
  _generateAddressesByPk(networksArr, encryptData) {
    const address = fromPrivate(encryptData).address;
    if (!this.pk) {
      return;
    }
    return networksArr.map(() => ({
      address,
      encryptPk: encryptData,
    }));
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

  _preCreateAddress({account, network, hex, pk, nativeBalance = '0x0'}) {
    return database.get('address').prepareCreate(r => {
      r.account.set(account);
      r.network.set(network);
      r.value =
        network.networkType === 'cfx'
          ? encode(toAccountAddress(hex), network.netId)
          : hex;
      r.hex = hex;
      r.pk = pk;
      r.native_balance = nativeBalance;
    });
  }
  async addVault() {
    // not support pub hw and cfxOnly for now
    const isDuplicate = await validateDuplicateVault(
      this.password,
      this.mnemonic || this.pk,
    );

    if (isDuplicate) {
      throw new Error('duplicate mnemonic or pk!');
    }

    if (!this.mnemonic && !this.pk) {
      throw new Error('need mnemonic or pk!');
    }

    const encryptData = await encrypt.encrypt(this.password, {
      data: this.mnemonic || this.pk,
    });

    // const networksArr = await getNetworks();
    let hdRets = [];

    if (this.mnemonic) {
      hdRets = await Promise.all(
        this._generateAddressesByMnemonic(this.networks),
      );
    } else {
      hdRets = this._generateAddressesByPk(this.networks, encryptData);
    }

    const vaultTableInstance = this._preCreateVault(encryptData);
    const accountGroupTableInstance = this._preCreateAccountGroup(
      vaultTableInstance,
      this.accountGroups,
    );

    const accountTableInstance = this._preCreateAccount({
      accountGroup: accountGroupTableInstance,
      groups: this.accountGroups,
      accountIndex: 0,
    });
    const addressTableInstance = hdRets.map(({address, encryptPk}, index) => {
      return this._preCreateAddress({
        account: accountTableInstance,
        network: this.networks[index],
        hex: address,
        pk: encryptPk,
      });
    });
    await database.write(async () => {
      await database.batch(
        vaultTableInstance,
        accountGroupTableInstance,
        accountTableInstance,
        ...addressTableInstance,
      );
    });
  }
}

export default Vault;
