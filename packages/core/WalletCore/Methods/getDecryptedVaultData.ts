import { injectable, inject } from 'inversify';
import { Plugins } from '../Plugins';
import VaultType from '../../database/models/Vault/VaultType';
import { type Vault } from '../../database/models/Vault';
import { type Address } from '../../database/models/Address';
import database from '../../database';
import TableName from '../../database/TableName';
import { getNthAccountOfHDKey } from '../../utils/hdkey';

@injectable()
export class GetDecryptedVaultDataMethod {
  @inject(Plugins) plugins!: Plugins;
  getMnemonicOfVault = async (targetVaultOrId: Vault | string) => {
    const targetVault = typeof targetVaultOrId === 'string' ? ((await database.get(TableName.Vault).find(targetVaultOrId)) as Vault) : targetVaultOrId;
    if (targetVault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('Cannot get mnemonic of non-HierarchicalDeterministic type vault');
    }
    return this.plugins.CryptoTool.decrypt(targetVault.data!) as Promise<string>;
  };

  getPrivateKeyOfVault = async (targetVaultOrId: Vault | string) => {
    const targetVault = typeof targetVaultOrId === 'string' ? ((await database.get(TableName.Vault).find(targetVaultOrId)) as Vault) : targetVaultOrId;
    if (targetVault.type !== VaultType.PrivateKey) {
      throw new Error('Cannot get private key of non-PrivateKey type vault');
    }
    return this.plugins.CryptoTool.decrypt(targetVault.data!) as Promise<string>;
  };

  getPrivateKeyOfAddress = async (targetAddressOrId: Address | string) => {
    const targetAddress =
      typeof targetAddressOrId === 'string' ? ((await database.get(TableName.Address).find(targetAddressOrId)) as Address) : targetAddressOrId;
    if (!targetAddress) throw new Error('Cannot get private key of empty address');
    const [account, network] = await Promise.all([targetAddress.account, targetAddress.network]);
    const accountGroup = await account.accountGroup;
    const vault = await accountGroup.vault;
    if (vault.type === VaultType.PrivateKey) {
      return this.getMnemonicOfVault(vault);
    } else if (vault.type === VaultType.HierarchicalDeterministic) {
      const [mnemonic, hdPath] = await Promise.all([this.getMnemonicOfVault(vault), network.hdPath]);
      const { privateKey } = await getNthAccountOfHDKey({
        mnemonic,
        hdPath: hdPath.value,
        nth: account.index,
      });
      return privateKey;
    }
    throw new Error(`Cannot get private key of ${vault.type} type vault's address`);
  };
}
