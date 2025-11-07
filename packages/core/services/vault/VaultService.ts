import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Vault } from '@core/database/models/Vault';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { NetworkType } from '@core/types';
import { toChecksum } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { generateMnemonic, getNthAccountOfHDKey } from '@core/utils/hdkey';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable } from 'inversify';
import { VAULT_DEFAULTS } from './constants';
import type { CreateHDVaultInput, IVault } from './types';

@injectable()
export class VaultService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  @inject(SERVICE_IDENTIFIER.CRYPTO_TOOL)
  private readonly cryptoTool!: ICryptoTool;

  private async resolveAccountGroup(vault: Vault, existingAccountGroupId?: string): Promise<AccountGroup> {
    if (existingAccountGroupId) {
      return this.database.get<AccountGroup>(TableName.AccountGroup).find(existingAccountGroupId);
    }
    return vault.getAccountGroup();
  }

  private async toInterface(vault: Vault, accountGroupId?: string): Promise<IVault> {
    const group = await this.resolveAccountGroup(vault, accountGroupId);
    return {
      id: vault.id,
      type: vault.type,
      device: vault.device,
      isBackup: vault.isBackup,
      source: vault.source,
      isGroup: vault.isGroup,
      accountGroupId: group.id,
    };
  }

  private async isFirstVault(): Promise<boolean> {
    const count = await this.database.get<Vault>(TableName.Vault).query().fetchCount();
    return count === 0;
  }

  private async countVaultsOfType(type: VaultType): Promise<number> {
    return this.database.get<Vault>(TableName.Vault).query(Q.where('type', type)).fetchCount();
  }

  /**
   * Create or import an HD wallet.
   * Creates a vault, account group, first account, and addresses for all networks.
   */
  async createHDVault(input: CreateHDVaultInput): Promise<IVault> {
    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    if (networks.length === 0) {
      throw new Error('No networks configured for vault creation.');
    }

    const mnemonic = input.mnemonic ?? (await generateMnemonic());
    const isImport = Boolean(input.mnemonic);

    const [encryptedMnemonic, isFirstVault, sameTypeCount] = await Promise.all([
      this.cryptoTool.encrypt(mnemonic, input.password),
      this.isFirstVault(),
      this.countVaultsOfType(VaultType.HierarchicalDeterministic),
    ]);

    const vaultRecord = this.database.get<Vault>(TableName.Vault).prepareCreate((record) => {
      record.type = VaultType.HierarchicalDeterministic;
      record.device = VAULT_DEFAULTS.DEVICE;
      record.data = encryptedMnemonic;
      record.cfxOnly = false;
      record.isBackup = isImport;
      record.source = isImport ? VaultSourceType.IMPORT_BY_USER : VaultSourceType.CREATE_BY_WALLET;
    });

    const accountGroup = this.database.get<AccountGroup>(TableName.AccountGroup).prepareCreate((record) => {
      record.nickname = `${VAULT_DEFAULTS.HD_GROUP_LABEL} - ${sameTypeCount + 1}`;
      record.hidden = false;
      record.vault.set(vaultRecord);
    });

    const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
      record.nickname = input.accountNickname ?? 'Account - 1';
      record.index = 0;
      record.hidden = false;
      record.selected = isFirstVault;
      record.accountGroup.set(accountGroup);
    });

    const addresses = await Promise.all(
      networks.map(async (network) => {
        const hdPath = await network.hdPath.fetch();
        const assetRule = await network.defaultAssetRule;
        if (!assetRule) {
          throw new Error(`Missing default asset rule for network ${network.id}`);
        }

        const { hexAddress } = await getNthAccountOfHDKey({
          mnemonic,
          hdPath: hdPath.value,
          nth: 0,
        });
        const checksum = toChecksum(hexAddress);

        return this.database.get<Address>(TableName.Address).prepareCreate((record) => {
          record.account.set(account);
          record.network.set(network);
          record.assetRule.set(assetRule);
          record.hex = checksum;
          record.base32 = network.networkType === NetworkType.Conflux ? convertHexToBase32(checksum, network.netId) : checksum;
        });
      }),
    );

    await this.database.write(async () => {
      await this.database.batch(vaultRecord, accountGroup, account, ...addresses);
    });

    return this.toInterface(vaultRecord, accountGroup.id);
  }
  private async getDecryptedMnemonic(vault: Vault, password?: string): Promise<string> {
    if (vault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('Mnemonic is only available for HD vaults.');
    }
    if (!vault.data) {
      throw new Error('Vault data is missing.');
    }
    return this.cryptoTool.decrypt<string>(vault.data, password);
  }

  /**
   * Get the mnemonic phrase for an HD vault.
   * @throws {Error} If vault is not HD type or data is missing
   */
  async getMnemonic(vaultId: string, password?: string): Promise<string> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    return this.getDecryptedMnemonic(vault, password);
  }

  /**
   * Get the private key for a specific address.
   * Works with HD vaults (derives key) and PrivateKey vaults (decrypts stored key).
   * @throws {Error} If vault type doesn't support private key export (e.g. BSIM)
   */
  async getPrivateKey(vaultId: string, addressId: string, password?: string): Promise<string> {
    const [vault, address] = await Promise.all([
      this.database.get<Vault>(TableName.Vault).find(vaultId),
      this.database.get<Address>(TableName.Address).find(addressId),
    ]);

    const account = await address.account.fetch();
    const accountGroup = await account.accountGroup.fetch();
    if (accountGroup.vault.id !== vault.id) {
      throw new Error('Address does not belong to the provided vault.');
    }

    if (vault.type === VaultType.PrivateKey) {
      if (!vault.data) {
        throw new Error('Vault data is missing.');
      }
      return this.cryptoTool.decrypt<string>(vault.data, password);
    }

    if (vault.type === VaultType.HierarchicalDeterministic) {
      const [mnemonic, network] = await Promise.all([this.getDecryptedMnemonic(vault, password), address.network.fetch()]);
      const hdPath = await network.hdPath.fetch();

      const { privateKey } = await getNthAccountOfHDKey({
        mnemonic,
        hdPath: hdPath.value,
        nth: account.index,
      });

      return privateKey;
    }

    throw new Error(`Vault type ${vault.type} does not expose a private key.`);
  }
}
