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
import { fromPrivate, toChecksum } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { generateMnemonic, getNthAccountOfHDKey } from '@core/utils/hdkey';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable } from 'inversify';
import { VAULT_ACCOUNT_PREFIX, VAULT_DEFAULTS, VAULT_GROUP_LABEL } from './constants';
import type { CreateBSIMVaultInput, CreateHDVaultInput, CreatePrivateKeyVaultInput, CreatePublicAddressVaultInput, IVault } from './types';

@injectable()
export class VaultService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  @inject(SERVICE_IDENTIFIER.CRYPTO_TOOL)
  private readonly cryptoTool!: ICryptoTool;

  private async toInterface(vault: Vault, accountGroupId?: string): Promise<IVault> {
    const group = accountGroupId ? await this.database.get<AccountGroup>(TableName.AccountGroup).find(accountGroupId) : await vault.getAccountGroup();

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

  private async fetchNetworks(): Promise<Network[]> {
    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    if (!networks.length) {
      throw new Error('No networks configured for vault creation.');
    }
    return networks;
  }

  private createAccountGroupRecord(vaultRecord: Vault, type: VaultType, index: number) {
    return this.database.get<AccountGroup>(TableName.AccountGroup).prepareCreate((record) => {
      record.nickname = `${VAULT_GROUP_LABEL[type]} - ${index + 1}`;
      record.hidden = false;
      record.vault.set(vaultRecord);
    });
  }

  private createAccountRecord(accountGroup: AccountGroup, nickname: string, params: { index: number; hidden?: boolean; selected?: boolean }) {
    const { index, hidden = false, selected = false } = params;
    return this.database.get<Account>(TableName.Account).prepareCreate((record) => {
      record.nickname = nickname;
      record.index = index;
      record.hidden = hidden;
      record.selected = selected;
      record.accountGroup.set(accountGroup);
    });
  }

  private async prepareAddresses(account: Account, networks: Network[], resolveHex: (network: Network) => Promise<string>): Promise<Address[]> {
    return Promise.all(
      networks.map(async (network) => {
        const assetRule = await network.defaultAssetRule;
        if (!assetRule) {
          throw new Error(`Missing default asset rule for network ${network.id}`);
        }
        const checksum = toChecksum(await resolveHex(network));
        return this.database.get<Address>(TableName.Address).prepareCreate((record) => {
          record.account.set(account);
          record.network.set(network);
          record.assetRule.set(assetRule);
          record.hex = checksum;
          record.base32 = network.networkType === NetworkType.Conflux ? convertHexToBase32(checksum, network.netId) : checksum;
        });
      }),
    );
  }

  /**
   * Create or import an HD wallet.
   */
  async createHDVault(input: CreateHDVaultInput): Promise<IVault> {
    const networks = await this.fetchNetworks();

    const mnemonic = input.mnemonic ?? generateMnemonic();
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

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.HierarchicalDeterministic, sameTypeCount);

    const defaultNickname = `${VAULT_ACCOUNT_PREFIX[VaultType.HierarchicalDeterministic]} - 1`;
    const account = this.createAccountRecord(accountGroup, input.accountNickname ?? defaultNickname, {
      index: 0,
      selected: isFirstVault,
    });

    const addresses = await this.prepareAddresses(account, networks, async (network) => {
      const hdPath = await network.hdPath.fetch();
      const { hexAddress } = await getNthAccountOfHDKey({
        mnemonic,
        hdPath: hdPath.value,
        nth: 0,
      });
      return hexAddress;
    });

    await this.database.write(async () => {
      await this.database.batch(vaultRecord, accountGroup, account, ...addresses);
    });

    return this.toInterface(vaultRecord, accountGroup.id);
  }

  /**
   * import a private key vault.
   */
  async createPrivateKeyVault(input: CreatePrivateKeyVaultInput): Promise<IVault> {
    const networks = await this.fetchNetworks();

    const [encryptedKey, isFirstVault, sameTypeCount] = await Promise.all([
      this.cryptoTool.encrypt(input.privateKey, input.password),
      this.isFirstVault(),
      this.countVaultsOfType(VaultType.PrivateKey),
    ]);

    const vaultRecord = this.database.get<Vault>(TableName.Vault).prepareCreate((record) => {
      record.type = VaultType.PrivateKey;
      record.device = VAULT_DEFAULTS.DEVICE;
      record.data = encryptedKey;
      record.cfxOnly = false;
      record.isBackup = true;
      record.source = VaultSourceType.IMPORT_BY_USER;
    });

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.PrivateKey, sameTypeCount);

    const defaultNickname = `${VAULT_ACCOUNT_PREFIX[VaultType.PrivateKey]} - ${sameTypeCount + 1}`;
    const account = this.createAccountRecord(accountGroup, input.accountNickname ?? defaultNickname, {
      index: 0,
      selected: isFirstVault,
    });

    const addresses = await this.prepareAddresses(account, networks, async () => fromPrivate(input.privateKey).address);

    await this.database.write(async () => {
      await this.database.batch(vaultRecord, accountGroup, account, ...addresses);
    });

    return this.toInterface(vaultRecord, accountGroup.id);
  }

  /**
   * Import a BSIM wallet
   */
  async createBSIMVault(input: CreateBSIMVaultInput): Promise<IVault> {
    if (!input.accounts.length) {
      throw new Error('BSIM vault requires at least one account.');
    }

    const networks = await this.fetchNetworks();
    const [isFirstVault, sameTypeCount] = await Promise.all([this.isFirstVault(), this.countVaultsOfType(VaultType.BSIM)]);

    const vaultRecord = this.database.get<Vault>(TableName.Vault).prepareCreate((record) => {
      record.type = VaultType.BSIM;
      record.device = VAULT_DEFAULTS.DEVICE;
      record.data = 'BSIM Wallet';
      record.cfxOnly = false;
      record.isBackup = false;
      record.source = VaultSourceType.CREATE_BY_WALLET;
    });

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.BSIM, sameTypeCount);

    const accountRecords: Account[] = [];
    const addressRecords: Address[] = [];

    for (let idx = 0; idx < input.accounts.length; idx += 1) {
      const { index, hexAddress } = input.accounts[idx];

      const nickname = `${VAULT_ACCOUNT_PREFIX[VaultType.BSIM]} - ${idx + 1}`;
      const account = this.createAccountRecord(accountGroup, nickname, {
        index,
        selected: isFirstVault && idx === 0,
      });

      const addresses = await this.prepareAddresses(account, networks, async () => hexAddress);

      accountRecords.push(account);
      addressRecords.push(...addresses);
    }

    await this.database.write(async () => {
      await this.database.batch(vaultRecord, accountGroup, ...accountRecords, ...addressRecords);
    });

    return this.toInterface(vaultRecord, accountGroup.id);
  }

  /**
   * Import a public address
   */
  async createPublicAddressVault(input: CreatePublicAddressVaultInput): Promise<IVault> {
    const networks = await this.fetchNetworks();
    const [isFirstVault, sameTypeCount] = await Promise.all([this.isFirstVault(), this.countVaultsOfType(VaultType.PublicAddress)]);

    const vaultRecord = this.database.get<Vault>(TableName.Vault).prepareCreate((record) => {
      record.type = VaultType.PublicAddress;
      record.device = VAULT_DEFAULTS.DEVICE;
      record.data = input.hexAddress;
      record.cfxOnly = false;
      record.isBackup = false;
      record.source = VaultSourceType.IMPORT_BY_USER;
    });

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.PublicAddress, sameTypeCount);

    const defaultNickname = `${VAULT_ACCOUNT_PREFIX[VaultType.PublicAddress]} - ${sameTypeCount + 1}`;
    const account = this.createAccountRecord(accountGroup, input.accountNickname ?? defaultNickname, {
      index: 0,
      selected: isFirstVault,
    });

    const addresses = await this.prepareAddresses(account, networks, async () => input.hexAddress);

    await this.database.write(async () => {
      await this.database.batch(vaultRecord, accountGroup, account, ...addresses);
    });

    return this.toInterface(vaultRecord, accountGroup.id);
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

  private async getDecryptedMnemonic(vault: Vault, password?: string): Promise<string> {
    if (vault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('Mnemonic is only available for HD vaults.');
    }
    if (!vault.data) {
      throw new Error('Vault data is missing.');
    }
    return this.cryptoTool.decrypt<string>(vault.data, password);
  }

  async listVaults(): Promise<IVault[]> {
    const vaults = await this.database.get<Vault>(TableName.Vault).query().fetch();
    return Promise.all(vaults.map((vault) => this.toInterface(vault)));
  }

  async hasAnyVault(): Promise<boolean> {
    const count = await this.database.get<Vault>(TableName.Vault).query().fetchCount();
    return count > 0;
  }

  async deleteVault(vaultId: string): Promise<void> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    await this.database.write(async () => {
      await vault.delete();
    });
  }
}
