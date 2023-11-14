import { injectable, inject } from 'inversify';
import { Plugins } from '../plugins';
import VaultType from '../../database/models/Vault/VaultType';
import { type Vault } from '../../database/models/Vault';
import { type Address } from '../../database/models/Address';
import { getNthAccountOfHDKey } from '../../utils/hdkey';

@injectable()
export class GetDecryptedVaultDataMethod {
  @inject(Plugins) plugins!: Plugins;
  getMnemonicOfVault = (vault: Vault) => {
    if (vault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('Cannot get mnemonic of non-HierarchicalDeterministic type vault');
    }
    return this.plugins.CryptoTool.decrypt(vault.data!) as Promise<string>;
  };

  getPrivateKeyOfVault = async (vault: Vault) => {
    if (vault.type !== VaultType.PrivateKey) {
      throw new Error('Cannot get private key of non-PrivateKey type vault');
    }
    return this.plugins.CryptoTool.decrypt(vault.data!) as Promise<string>;
  };

  getPrivateKeyOfAddress = async (address: Address) => {
    if (!address) throw new Error('Cannot get private key of empty address');
    const [account, network] = await Promise.all([address.account, address.network]);
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
