import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { AddressBook } from '@core/database/models/AddressBook';
import type { Network } from '@core/database/models/Network';
import type { Permission } from '@core/database/models/Permission';
import type { Signature } from '@core/database/models/Signature';
import type { Tx } from '@core/database/models/Tx';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import type { Vault } from '@core/database/models/Vault';
import VaultSourceType from '@core/database/models/Vault/VaultSourceType';
import { VaultType } from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { NetworkType } from '@core/types';
import type { CryptoTool } from '@core/types/crypto';
import { fromPrivate, toChecksum } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { addHexPrefix, stripHexPrefix } from '@core/utils/base';
import { generateMnemonic, getNthAccountOfHDKey } from '@core/utils/hdkey';
import { type Model, Q } from '@nozbe/watermelondb';
import { Mnemonic } from 'ethers';
import { inject, injectable } from 'inversify';
import { getGroupedAccountNickname } from '../account/naming';
import { HardwareWalletService } from '../hardware/HardwareWalletService';
import { VAULT_ACCOUNT_PREFIX, VAULT_DEFAULTS, VAULT_GROUP_LABEL } from './constants';
import type { CreateBSIMVaultInput, CreateHDVaultInput, CreatePrivateKeyVaultInput, CreatePublicAddressVaultInput, DeleteVaultPlan, IVault } from './types';
import { verifyVaultPassword } from './verifyVaultPassword';

@injectable()
export class VaultService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(CORE_IDENTIFIERS.CRYPTO_TOOL)
  private readonly cryptoTool!: CryptoTool;

  @inject(HardwareWalletService)
  private readonly hardwareWalletService!: HardwareWalletService;

  private async toInterface(vault: Vault, accountGroupId?: string): Promise<IVault> {
    const group = accountGroupId ? await this.database.get<AccountGroup>(TableName.AccountGroup).find(accountGroupId) : await vault.getAccountGroup();

    return {
      id: vault.id,
      type: vault.type,
      device: vault.device,
      hardwareDeviceId: vault.hardwareDeviceId ?? null,
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

  // Future direction:
  // consider storing a secret fingerprint on Vault so duplicate checks
  // can avoid decrypting existing secrets and keep auth timing unchanged.
  async hasExistingSecretImport(params: { mnemonic?: string; privateKey?: string; password: string }): Promise<boolean> {
    const mnemonic = params.mnemonic?.trim();
    const privateKey = params.privateKey?.trim();
    const password = params.password;

    if (privateKey) {
      const inputPrivateKeyHex = addHexPrefix(stripHexPrefix(privateKey).toLowerCase());
      const privateKeyVaults = await this.database.get<Vault>(TableName.Vault).query(Q.where('type', VaultType.PrivateKey)).fetch();

      for (const vault of privateKeyVaults) {
        if (!vault.data) continue;

        try {
          const storedPrivateKey = await this.cryptoTool.decrypt<string>(vault.data, password);
          const storedPrivateKeyHex = addHexPrefix(stripHexPrefix(storedPrivateKey.trim()).toLowerCase());
          if (storedPrivateKeyHex === inputPrivateKeyHex) {
            return true;
          }
        } catch {
          // Skip unreadable records. Duplicate detection should not fail the whole import flow.
        }
      }

      return false;
    }

    if (mnemonic) {
      const inputMnemonicPhrase = Mnemonic.fromPhrase(mnemonic).phrase;
      const hdVaults = await this.database.get<Vault>(TableName.Vault).query(Q.where('type', VaultType.HierarchicalDeterministic)).fetch();

      for (const vault of hdVaults) {
        if (!vault.data) continue;

        try {
          const storedMnemonic = await this.cryptoTool.decrypt<string>(vault.data, password);
          const storedMnemonicPhrase = Mnemonic.fromPhrase(storedMnemonic).phrase;
          if (storedMnemonicPhrase === inputMnemonicPhrase) {
            return true;
          }
        } catch {
          // Skip unreadable records. Duplicate detection should not fail the whole import flow.
        }
      }

      return false;
    }

    return false;
  }

  async verifyPassword(password: string): Promise<boolean> {
    return verifyVaultPassword({ database: this.database, cryptoTool: this.cryptoTool, password });
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
      record.hardwareDeviceId = null;
      record.data = encryptedMnemonic;
      record.cfxOnly = false;
      record.isBackup = isImport;
      record.source = isImport ? VaultSourceType.IMPORT_BY_USER : VaultSourceType.CREATE_BY_WALLET;
    });

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.HierarchicalDeterministic, sameTypeCount);

    const defaultNickname = getGroupedAccountNickname(0);
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
    let resolvedAccounts = input.accounts;
    let resolvedHardwareDeviceId = input.hardwareDeviceId;

    if (!resolvedAccounts) {
      const result = await this.hardwareWalletService.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, input.connectOptions);
      const detected = result.accounts.map((account) => ({
        index: account.index,
        hexAddress: account.address,
      }));
      detected.sort((a, b) => a.index - b.index);

      // create bsim wallet we only get one account from the device
      resolvedAccounts = detected.slice(0, 1);
      resolvedHardwareDeviceId = resolvedHardwareDeviceId ?? result.deviceId;
    }

    if (!resolvedAccounts.length) {
      throw new Error('BSIM vault requires at least one account.');
    }

    const networks = await this.fetchNetworks();
    const [isFirstVault, sameTypeCount] = await Promise.all([this.isFirstVault(), this.countVaultsOfType(VaultType.BSIM)]);
    let bsimMarker = 'BSIM Wallet';
    if (typeof input.password === 'string' && input.password.length > 0) {
      bsimMarker = await this.cryptoTool.encrypt('BSIM Wallet', input.password);
    }

    const vaultRecord = this.database.get<Vault>(TableName.Vault).prepareCreate((record) => {
      record.type = VaultType.BSIM;
      record.device = VAULT_DEFAULTS.DEVICE;
      record.hardwareDeviceId = resolvedHardwareDeviceId ?? null;
      record.data = bsimMarker;
      record.cfxOnly = false;
      record.isBackup = false;
      record.source = VaultSourceType.CREATE_BY_WALLET;
    });

    const accountGroup = this.createAccountGroupRecord(vaultRecord, VaultType.BSIM, sameTypeCount);

    const accountRecords: Account[] = [];
    const addressRecords: Address[] = [];

    for (let idx = 0; idx < resolvedAccounts.length; idx += 1) {
      const { index, hexAddress } = resolvedAccounts[idx];

      const nickname = getGroupedAccountNickname(index);
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
      record.hardwareDeviceId = null;
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
  async getMnemonic(vaultId: string, password: string): Promise<string> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    return this.getDecryptedMnemonic(vault, password);
  }

  /**
   * Get the private key for a specific address.
   * Works with HD vaults (derives key) and PrivateKey vaults (decrypts stored key).
   * @throws {Error} If vault type doesn't support private key export (e.g. BSIM)
   */
  async getPrivateKey(vaultId: string, addressId: string, password: string): Promise<string> {
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

  private async getDecryptedMnemonic(vault: Vault, password: string): Promise<string> {
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

  private getUniqueIds(ids: Array<string | null | undefined>): string[] {
    return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  }

  private async queryByIds<TRecord extends Model>(tableName: TableName, columnName: string, ids: Array<string | null | undefined>): Promise<TRecord[]> {
    const uniqueIds = this.getUniqueIds(ids);
    if (!uniqueIds.length) {
      return [];
    }

    return this.database
      .get<TRecord>(tableName)
      .query(Q.where(columnName, Q.oneOf(uniqueIds)))
      .fetch();
  }

  private async findAccountGroupByVaultIdOrThrow(vaultId: string): Promise<AccountGroup> {
    const groups = await this.database.get<AccountGroup>(TableName.AccountGroup).query(Q.where('vault_id', vaultId)).fetch();
    const group = groups[0];
    if (!group) {
      throw new Error(`AccountGroup for vault ${vaultId} not found.`);
    }
    return group;
  }

  private async buildVaultDeletionPlan(vault: Vault): Promise<DeleteVaultPlan> {
    const accountGroup = await this.findAccountGroupByVaultIdOrThrow(vault.id);
    const accounts = await this.queryByIds<Account>(TableName.Account, 'account_group_id', [accountGroup.id]);
    const accountIds = accounts.map((account) => account.id);

    const [permissions, addresses] = await Promise.all([
      this.queryByIds<Permission>(TableName.Permission, 'account_id', accountIds),
      this.queryByIds<Address>(TableName.Address, 'account_id', accountIds),
    ]);
    const addressIds = addresses.map((address) => address.id);

    const [signatures, addressBooks, txs] = await Promise.all([
      this.queryByIds<Signature>(TableName.Signature, 'address_id', addressIds),
      this.queryByIds<AddressBook>(TableName.AddressBook, 'address_id', addressIds),
      this.queryByIds<Tx>(TableName.Tx, 'address_id', addressIds),
    ]);

    const [txPayloads, txExtras] = await Promise.all([
      this.queryByIds<TxPayload>(
        TableName.TxPayload,
        'id',
        txs.map((tx) => tx.txPayload.id),
      ),
      this.queryByIds<TxExtra>(
        TableName.TxExtra,
        'id',
        txs.map((tx) => tx.txExtra.id),
      ),
    ]);

    return {
      vault,
      accountGroup,
      accounts,
      permissions,
      addresses,
      signatures,
      addressBooks,
      txs,
      txPayloads,
      txExtras,
    };
  }

  private toVaultDeletionOperations(plan: DeleteVaultPlan) {
    return [
      ...plan.signatures.map((signature) => signature.prepareDestroyPermanently()),
      ...plan.addressBooks.map((addressBook) => addressBook.prepareDestroyPermanently()),
      ...plan.permissions.map((permission) => permission.prepareDestroyPermanently()),
      ...plan.txs.map((tx) => tx.prepareDestroyPermanently()),
      ...plan.txPayloads.map((txPayload) => txPayload.prepareDestroyPermanently()),
      ...plan.txExtras.map((txExtra) => txExtra.prepareDestroyPermanently()),
      ...plan.addresses.map((address) => address.prepareDestroyPermanently()),
      ...plan.accounts.map((account) => account.prepareDestroyPermanently()),
      plan.accountGroup.prepareDestroyPermanently(),
      plan.vault.prepareDestroyPermanently(),
    ];
  }

  async deleteVault(vaultId: string): Promise<void> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    const operations = this.toVaultDeletionOperations(await this.buildVaultDeletionPlan(vault));

    await this.database.write(async () => {
      if (operations.length) {
        await this.database.batch(...operations);
      }
    });
  }

  async finishBackup(vaultId: string): Promise<void> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    await vault.finishBackup();
  }
}
