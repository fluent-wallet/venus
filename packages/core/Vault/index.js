import { fromPrivate } from '@fluent-wallet/account';
import { generateAddressesByMnemonic } from '../utils';
import database from '../Database';
import { validateDuplicateVault, preCreateAccount, preCreateAddress } from '../utils';
import encrypt from '../utils/encrypt';

class Vault {
  constructor({ password, mnemonic, pk, device = 'VenusMobile', networks, accountGroups }) {
    this.password = password;
    this.mnemonic = mnemonic;
    this.pk = pk;
    this.device = device;
    this.networks = networks;
    this.accountGroups = accountGroups;
  }

  // _generateAddressesByMnemonic(networksArr, nth = 0) {
  //   return networksArr.map(async ({hdPath}) => {
  //     const hdPathRecord = await hdPath.fetch();
  //     const ret = await getNthAccountOfHDKey({
  //       mnemonic: this.mnemonic,
  //       hdPath: hdPathRecord.value,
  //       nth,
  //     });
  //     ret.encryptPk = await encrypt.encrypt(this.password, {
  //       pk: ret.privateKey,
  //     });
  //     // console.log('ret', ret);
  //     return ret;
  //   });
  // }
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
    return database.get('vault').prepareCreate((r) => {
      r.type = this.mnemonic ? 'hd' : 'pk';
      r.data = encryptData;
      r.device = this.device;
    });
  }
  _preCreateAccountGroup(vault, groups) {
    return database.get('account_group').prepareCreate((r) => {
      r.nickname = `group-${groups.length + 1}`;
      r.hidden = false;
      r.vault.set(vault);
    });
  }

  // _preCreateAccount({
  //   accountGroup,
  //   groups,
  //   accountIndex,
  //   hidden = false,
  //   selected = false,
  // }) {
  //   return database.get('account').prepareCreate(r => {
  //     r.accountGroup.set(accountGroup);
  //     r.index = accountIndex;
  //     r.nickname = `group-${groups.length + 1}-${accountIndex}`;
  //     r.hidden = hidden;
  //     r.selected = selected;
  //   });
  // }

  // _preCreateAddress({account, network, hex, pk, nativeBalance = '0x0'}) {
  //   return database.get('address').prepareCreate(r => {
  //     r.account.set(account);
  //     r.network.set(network);
  //     r.value =
  //       network.networkType === 'cfx'
  //         ? encode(toAccountAddress(hex), network.netId)
  //         : hex;
  //     r.hex = hex;
  //     r.pk = pk;
  //     r.native_balance = nativeBalance;
  //   });
  // }
  async addVault() {
    // not support pub hw and cfxOnly for now
    const isDuplicate = await validateDuplicateVault(this.password, this.mnemonic || this.pk);

    if (isDuplicate) {
      throw new Error('duplicate mnemonic or pk!');
    }

    if (!this.mnemonic && !this.pk) {
      throw new Error('need mnemonic or pk!');
    }

    const encryptData = await encrypt.encrypt(this.password, {
      data: this.mnemonic || this.pk,
    });

    let hdRets = [];

    if (this.mnemonic) {
      hdRets = await Promise.all(
        generateAddressesByMnemonic({
          networksArr: this.networks,
          mnemonic: this.mnemonic,
          password: this.password,
        })
      );
    } else {
      hdRets = this._generateAddressesByPk(this.networks, encryptData);
    }
    const vaultTableInstance = this._preCreateVault(encryptData);
    const accountGroupTableInstance = this._preCreateAccountGroup(vaultTableInstance, this.accountGroups);

    const accountTableInstance = preCreateAccount({
      accountGroup: accountGroupTableInstance,
      groupName: `group-${this.accountGroups.length + 1}`,
      accountIndex: 0,
    });
    const addressTableInstance = hdRets.map(({ address, encryptPk }, index) => {
      return preCreateAddress({
        account: accountTableInstance,
        network: this.networks[index],
        hex: address,
        pk: encryptPk,
      });
    });
    await database.write(async () => {
      await database.batch(vaultTableInstance, accountGroupTableInstance, accountTableInstance, ...addressTableInstance);
    });
  }
}

export default Vault;
