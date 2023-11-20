import { injectable } from 'inversify';
import { type Vault } from '../../database/models/Vault';
import database from '../../database';

@injectable()
export class VaultMethod {
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
}
