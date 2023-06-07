import database from '../Database';
import {getDuplicatesByContent} from '../utils/validateDuplicateRecords';
import Encrypt from '../utils/encrypt';
const encrypt = new Encrypt();

class Vault {
  constructor({
    password,
    mnemonic,
    pk,
    accountGroupName,
    device = 'VenusMobile',
  }) {
    this.password = password;
    this.mnemonic = mnemonic;
    this.pk = pk;
    this.accountGroupName = accountGroupName;
    this.device = device;
  }

  _generateAccountsByMnemonic() {}
  _preCreateVault(encryptData) {
    return database.get('vault').prepareCreate(r => {
      r.type = this.mnemonic ? 'hd' : 'pk';
      r.data = encryptData;
      r.device = this.device;
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

    await database.write(async () => {
      // await database.batch();
    });
  }
}

export default Vault;
