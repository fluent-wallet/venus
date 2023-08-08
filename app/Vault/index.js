import {fromPrivate, toAccountAddress} from '@fluent-wallet/account';
import {encode} from '@fluent-wallet/base32-address';
import {generateAddressesByMnemonic} from '../utils';
import database from '../Database';
import {
  validateDuplicateVault,
  preCreateAccount,
  preCreateAddress,
} from '../utils';
import Encrypt from '../utils/encrypt';
import {getCurrentNetwork, getNetworkTokens} from '../Query';
import Balance from '../Balance';
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

  _generateAddressesByPk(networksArr, encryptData) {
    if (!this.pk) {
      return;
    }
    const address = fromPrivate(this.pk).address;

    return networksArr.map((net, index) => ({
      address,
      encryptPk: encryptData,
      networkIndex: index,
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

  async addVault() {
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
    const currentNetwork = await getCurrentNetwork();
    const currentTokens = await getNetworkTokens(currentNetwork[0].id);

    const balance = new Balance(currentNetwork[0]);

    const encryptData = await encrypt.encrypt(this.password, {
      data: this.mnemonic || this.pk,
    });

    let hdRets = [];

    if (this.mnemonic) {
      for (let i = 0; i < 5; i++) {
        const addrRets = await generateAddressesByMnemonic({
          networksArr: this.networks,
          mnemonic: this.mnemonic,
          password: this.password,
          nth: i,
        });
        const curAddrRet = addrRets.filter(
          ({isCurrentNet}) => !!isCurrentNet,
        )[0];
        const hasBalance = await balance.hasBalance({
          userAddress:
            currentNetwork[0].networkType === 'cfx'
              ? encode(
                  toAccountAddress(curAddrRet.address),
                  currentNetwork[0].netId,
                )
              : curAddrRet.address,
          tokenAddress: currentTokens.map(({tokenAddress}) => tokenAddress),
          checkerAddress: currentNetwork[0].balanceChecker,
        });

        if (hasBalance) {
          hdRets = [...hdRets, ...addrRets];
        } else {
          if (hdRets.length === 0) {
            hdRets = [...addrRets];
          }
          break;
        }
      }
    } else {
      hdRets = this._generateAddressesByPk(this.networks, encryptData);
    }
    const vaultTableInstance = this._preCreateVault(encryptData);
    const accountGroupTableInstance = this._preCreateAccountGroup(
      vaultTableInstance,
      this.accountGroups,
    );

    const accountTableInstance = [];
    const addressTableInstance = [];

    const groupName = `group-${this.accountGroups.length + 1}`;
    for (let i = 0; i < hdRets.length; i++) {
      const {address, encryptPk, networkIndex, index} = hdRets[i];
      if (i === 0 || hdRets[i].index !== hdRets[i - 1].index) {
        accountTableInstance.push(
          preCreateAccount({
            accountGroup: accountGroupTableInstance,
            groupName,
            accountIndex: this.pk ? 1 : index + 1,
          }),
        );
      }
      addressTableInstance.push(
        preCreateAddress({
          account: accountTableInstance[index],
          network: this.networks[networkIndex],
          hex: address,
          pk: encryptPk,
        }),
      );
    }
    await database.write(async () => {
      await database.batch(
        vaultTableInstance,
        accountGroupTableInstance,
        ...accountTableInstance,
        ...addressTableInstance,
      );
    });
  }
}

export default Vault;
