import { inject, injectable } from 'inversify';
import database from '../../database';
import type { Vault } from '../../database/models/Vault';
import { getEncryptedVault } from '../../database/models/Vault/query';
import { Plugins } from '../Plugins';

@injectable()
export class VaultMethod {
  @inject(Plugins) plugins!: Plugins;

  async deleteVault(vault: Vault) {
    console.log(vault);
    const accountGroup = await vault.getAccountGroup();
    console.log(accountGroup, 'accountGroup');
    console.log(accountGroup.accounts, 'accountGroup.accounts');
    const accounts = await accountGroup.accounts;
    console.log(accounts, 'accounts');
    const addresses = (await Promise.all(accounts.map(async (account) => await account.addresses))).flat();
    const permissions = (await Promise.all(accounts.map(async (account) => await account.permissions))).flat();
    const signatures = (await Promise.all(addresses.map(async (address) => await address.signatures))).flat();
    const addressBooks = (await Promise.all(addresses.map(async (address) => await address.addressBooks))).flat();
    const txs = (await Promise.all(addresses.map(async (address) => await address.txs))).flat();
    const txPayloads = (await Promise.all(txs.map(async (tx) => await tx.txPayload))).flat();
    const txExtras = (await Promise.all(txs.map(async (tx) => await tx.txExtra))).flat();

    await database.write(async () => {
      await database.batch([
        ...signatures.map((signature) => signature.prepareDestroyPermanently()),
        ...addressBooks.map((addressBook) => addressBook.prepareDestroyPermanently()),
        ...txExtras.map((txExtra) => txExtra.prepareDestroyPermanently()),
        ...txPayloads.map((txPayload) => txPayload.prepareDestroyPermanently()),
        ...txs.map((tx) => tx.prepareDestroyPermanently()),
        ...addresses.map((address) => address.prepareDestroyPermanently()),
        ...accounts.map((account) => account.prepareDestroyPermanently()),
        ...permissions.map((permission) => permission.prepareDestroyPermanently()),
        accountGroup.prepareDestroyPermanently(),
        vault.prepareDestroyPermanently(),
      ]);
    });
  }

  checkHasSameVault = async (data: string) => {
    const vaults = await getEncryptedVault();
    const decryptDatas = await Promise.all(vaults.map((vault) => this.plugins.CryptoTool.decrypt<string>(vault.data!)));
    return decryptDatas?.includes(data);
  };
}
