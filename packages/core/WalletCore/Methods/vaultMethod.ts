import { injectable, inject } from 'inversify';
import { Plugins } from '../Plugins';
import { type Vault } from '../../database/models/Vault';
import { getEncryptedVault } from '../../database/models/Vault/query';
import database from '../../database';

@injectable()
export class VaultMethod {
  @inject(Plugins) plugins!: Plugins;

  async deleteVault(vault: Vault) {
    const accountGroup = await vault.getAccountGroup();
    const accounts = await accountGroup.accounts;
    const addresses = (await Promise.all(accounts.map(async (account) => await account.addresses))).flat();
    await database.write(async () => {
      await database.batch(
        ...addresses.map((address) => address.prepareDestroyPermanently()),
        ...accounts.map((account) => account.prepareDestroyPermanently()),
        accountGroup.prepareDestroyPermanently(),
        vault.prepareDestroyPermanently()
      );
    });
  }

  checkHasSameVault = async (data: string) => {
    const vaults = await getEncryptedVault();
    const decryptDatas = await Promise.all(vaults.map((vault) => this.plugins.CryptoTool.decrypt<string>(vault.data!)));
    return decryptDatas?.includes(data);
  };
}
