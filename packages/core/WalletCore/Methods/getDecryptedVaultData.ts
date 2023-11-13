import { injectable, inject } from 'inversify';
import { Plugins, PluginsSymbol } from '../plugins';
import { VaultType, type Vault } from '../../database/models/Vault';
import { type AccountGroup } from '../../database/models/AccountGroup';
import { type Account } from '../../database/models/Account';

@injectable()
export class getDecryptedVaultDataMethod {
  @inject(PluginsSymbol) plugins!: Plugins;

  getMnemonicOfVault = (vault: Vault) => {
    if (vault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('Cannot get mnemonic of non-HierarchicalDeterministic type vault');
    }
    return this.plugins.CryptoTool.decrypt(vault.data!) as Promise<string>;
  };

  getMnemonicOfAccountGroup = async (accountGroup: AccountGroup) => {
    const vault = await accountGroup.vault;
    return this.getMnemonicOfVault(vault);
  };

  getPrivateKeyOfVault = async (vault: Vault) => {
    if (vault.type !== VaultType.PrivateKey) {
      throw new Error('Cannot get private key of non-PrivateKey type vault');
    }
    return this.plugins.CryptoTool.decrypt(vault.data!) as Promise<string>;
  };

  getPrivateKeyOfAccount = async (account: Account) => {
    const accountGroup = await account.accountGroup;
    const vault = await accountGroup.vault;
    if (vault.type === VaultType.PrivateKey) {
      return this.getPrivateKeyOfVault(vault);
    } else if (vault.type === VaultType.HierarchicalDeterministic) {
      return this.getMnemonicOfVault(vault);
    }
    throw new Error(`Cannot get private key of ${vault.type} type vault's account`);
  };
}
