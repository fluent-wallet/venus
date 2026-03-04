import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Vault } from '@core/database/models/Vault';
import { VaultType } from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import type { AuthService } from '@core/modules/auth';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { NetworkType } from '@core/types';
import type { CryptoTool } from '@core/types/crypto';
import { toChecksum } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import { HardwareWalletService } from '../hardware/HardwareWalletService';
import type { IAccount } from './types';

@injectable()
export class AccountService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  @inject(CORE_IDENTIFIERS.AUTH)
  private readonly authService!: AuthService;

  @inject(CORE_IDENTIFIERS.CRYPTO_TOOL)
  private readonly cryptoTool!: CryptoTool;

  @inject(HardwareWalletService)
  private readonly hardwareWalletService!: HardwareWalletService;

  @inject(CORE_IDENTIFIERS.EVENT_BUS)
  @optional()
  private readonly eventBus?: EventBus<CoreEventMap>;

  async getCurrentAccount(): Promise<IAccount | null> {
    const account = await this.getCurrentAccountModel();
    if (!account) {
      return null;
    }
    return this.toInterface(account);
  }

  async switchAccount(accountId: string): Promise<void> {
    const targetAccount = await this.database.get<Account>(TableName.Account).find(accountId);

    if (targetAccount.selected) {
      return;
    }

    await this.database.write(async () => {
      const currentlySelected = await this.database.get<Account>(TableName.Account).query(Q.where('selected', true)).fetch();

      const operations = [
        ...currentlySelected.map((account) =>
          account.prepareUpdate((record) => {
            record.selected = false;
          }),
        ),
        targetAccount.prepareUpdate((record) => {
          record.selected = true;
        }),
      ];

      if (operations.length > 0) {
        await this.database.batch(...operations);
      }
    });

    const account = await this.getCurrentAccount();
    if (account) {
      this.eventBus?.emit('account/current-changed', { account });
    }
  }

  async getAccountById(accountId: string): Promise<IAccount | null> {
    try {
      const account = await this.database.get<Account>(TableName.Account).find(accountId);
      return this.toInterface(account);
    } catch {
      return null;
    }
  }

  async listAccounts(options: { includeHidden?: boolean } = {}): Promise<IAccount[]> {
    const conditions = options.includeHidden ? [] : [Q.where('hidden', false)];
    const accounts = await this.database
      .get<Account>(TableName.Account)
      .query(...conditions)
      .fetch();

    return Promise.all(accounts.map((item) => this.toInterface(item)));
  }

  async createHardwareAccount(vaultId: string): Promise<IAccount> {
    const { accountGroup } = await this.findAccountGroupByVault(vaultId);
    const existing = await accountGroup.accounts.fetch();
    const nextIndex = existing.length ? Math.max(...existing.map((account) => account.index)) + 1 : 0;

    const created = await this.createHardwareAccounts(vaultId, nextIndex);
    const last = created.at(-1);
    if (!last) {
      throw new Error('[AccountService] Failed to create hardware account.');
    }
    return last;
  }

  async createHardwareAccounts(vaultId: string, targetIndex: number): Promise<IAccount[]> {
    await this.hardwareWalletService.syncDerivedAccounts(vaultId, targetIndex);

    const { accountGroup } = await this.findAccountGroupByVault(vaultId);
    const accounts = await accountGroup.accounts.extend(Q.where('index', Q.lte(targetIndex)), Q.sortBy('index', Q.asc)).fetch();

    const result: IAccount[] = [];
    for (const account of accounts) {
      result.push(await this.toInterface(account));
    }
    return result;
  }

  async getAccountsByGroup(accountGroupId: string, options: { includeHidden?: boolean } = {}): Promise<IAccount[]> {
    const conditions = [Q.where('account_group_id', accountGroupId)];
    if (!options.includeHidden) {
      conditions.push(Q.where('hidden', false));
    }
    const accounts = await this.database
      .get<Account>(TableName.Account)
      .query(...conditions, Q.sortBy('index', Q.asc))
      .fetch();
    return Promise.all(accounts.map((item) => this.toInterface(item)));
  }

  async updateAccountNickName(accountId: string, nickname: string): Promise<IAccount> {
    const trimmed = nickname.trim();
    if (trimmed === '') {
      throw new Error('Nickname cannot be empty.');
    }
    const account = await this.findAccountOrThrow(accountId);
    await account.updateName(trimmed);

    return this.toInterface(account);
  }

  async setAccountHidden(accountId: string, hidden: boolean): Promise<IAccount> {
    const account = await this.findAccountOrThrow(accountId);
    await account.changeHidden(hidden);
    return this.toInterface(account);
  }

  async createNextGroupAccount(accountGroupId: string): Promise<IAccount> {
    const accountGroup = await this.database.get<AccountGroup>(TableName.AccountGroup).find(accountGroupId);
    const vault = await accountGroup.vault.fetch();

    const lastIndex = await this.database
      .get<Account>(TableName.Account)
      .query(Q.where('account_group_id', accountGroupId), Q.sortBy('index', Q.desc))
      .fetch()
      .then((accounts) => accounts[0]?.index ?? -1);

    const nextIndex = lastIndex + 1;

    if (vault.type === VaultType.HierarchicalDeterministic) {
      if (!vault.data) throw new Error('Vault data is missing.');

      const password = await this.authService.getPassword();
      const mnemonic = await this.cryptoTool.decrypt<string>(vault.data, password);
      const created = await this.createHdAccountsByIndexes({ accountGroupId, mnemonic, indexes: [nextIndex] });
      const last = created.at(-1);
      if (!last) throw new Error('Failed to create account.');
      return last;
    }

    if (vault.type === VaultType.BSIM) {
      const created = await this.createBsimAccountsByIndexes({ vaultId: vault.id, accountGroupId, indexes: [nextIndex] });
      const last = created.at(-1);
      if (!last) throw new Error('Failed to create account.');
      return last;
    }

    throw new Error('Only grouped vaults (HD/BSIM) support adding accounts.');
  }

  private async findAccountOrThrow(accountId: string): Promise<Account> {
    try {
      return await this.database.get<Account>(TableName.Account).find(accountId);
    } catch {
      throw new Error(`Account ${accountId} not found.`);
    }
  }

  async batchSetVisibility(changes: Array<{ accountId: string; hidden: boolean }>): Promise<IAccount[]> {
    if (!changes.length) {
      return [];
    }

    const accounts = await Promise.all(changes.map(({ accountId }) => this.findAccountOrThrow(accountId)));
    const operations: Array<{ account: Account; hidden: boolean }> = [];
    const groupStats = new Map<string, { initial: number; delta: number }>();

    for (let i = 0; i < accounts.length; i += 1) {
      const account = accounts[i];
      const nextHidden = changes[i].hidden;

      if (account.hidden === nextHidden) {
        continue;
      }

      const accountGroup = await account.accountGroup.fetch();
      let stats = groupStats.get(accountGroup.id);
      if (!stats) {
        stats = { initial: await accountGroup.visibleAccounts.count, delta: 0 };
        groupStats.set(accountGroup.id, stats);
      }

      stats.delta += nextHidden ? -1 : 1;
      operations.push({ account, hidden: nextHidden });
    }

    for (const { initial, delta } of groupStats.values()) {
      if (initial + delta <= 0) {
        throw new Error('Keep at least one account.');
      }
    }

    if (!operations.length) {
      return Promise.all(accounts.map((account) => this.toInterface(account)));
    }

    await this.database.write(async () => {
      const writes = operations.map(({ account, hidden }) => account.prepareChangeHidden(hidden));
      await this.database.batch(...writes);
    });

    return Promise.all(accounts.map((account) => this.toInterface(account)));
  }

  async createHdAccountsByIndexes(params: { accountGroupId: string; mnemonic: string; indexes: number[] }): Promise<IAccount[]> {
    const { accountGroupId, mnemonic } = params;
    const indexes = Array.from(new Set(params.indexes)).filter((i) => Number.isInteger(i) && i >= 0);
    indexes.sort((a, b) => a - b);

    if (!indexes.length) return [];
    if (mnemonic.trim() === '') throw new Error('Mnemonic cannot be empty.');

    const accountGroup = await this.database.get<AccountGroup>(TableName.AccountGroup).find(accountGroupId);
    const vault = await accountGroup.vault.fetch();
    if (vault.type !== VaultType.HierarchicalDeterministic) {
      throw new Error('createHdAccountsByIndexes only supports HD vault groups.');
    }

    const existingAccounts = await accountGroup.accounts.extend(Q.sortBy('index', Q.asc)).fetch();
    const existingIndexSet = new Set(existingAccounts.map((account) => account.index));
    const toCreate = indexes.filter((idx) => !existingIndexSet.has(idx));
    if (!toCreate.length) {
      return Promise.all(existingAccounts.filter((a) => indexes.includes(a.index)).map((a) => this.toInterface(a)));
    }

    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    if (!networks.length) throw new Error('No networks configured.');

    const preparedAccounts: Account[] = [];
    const preparedAddresses: Address[] = [];

    for (const index of toCreate) {
      const nickname = `Account - ${index + 1}`;
      const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
        record.nickname = nickname;
        record.index = index;
        record.hidden = false;
        record.selected = false;
        record.accountGroup.set(accountGroup);
      });

      const addresses = await this.prepareAddresses(account, networks, async (network) => {
        const hdPath = await network.hdPath.fetch();
        const { hexAddress } = await getNthAccountOfHDKey({ mnemonic, hdPath: hdPath.value, nth: index });
        return hexAddress;
      });

      preparedAccounts.push(account);
      preparedAddresses.push(...addresses);
    }

    await this.database.write(async () => {
      await this.database.batch(...preparedAccounts, ...preparedAddresses);
    });

    const finalAccounts = await accountGroup.accounts.extend(Q.where('index', Q.oneOf(indexes)), Q.sortBy('index', Q.asc)).fetch();
    return Promise.all(finalAccounts.map((a) => this.toInterface(a)));
  }

  async createBsimAccountsByIndexes(params: { vaultId: string; accountGroupId: string; indexes: number[] }): Promise<IAccount[]> {
    const indexes = Array.from(new Set(params.indexes)).filter((i) => Number.isInteger(i) && i >= 0);
    indexes.sort((a, b) => a - b);
    if (!indexes.length) return [];

    const accountGroup = await this.database.get<AccountGroup>(TableName.AccountGroup).find(params.accountGroupId);
    const vault = await accountGroup.vault.fetch();
    if (vault.id !== params.vaultId) {
      throw new Error('AccountGroup does not belong to the provided vault.');
    }
    if (vault.type !== VaultType.BSIM) {
      throw new Error('createBsimAccountsByIndexes only supports BSIM vault groups.');
    }

    const existingAccounts = await accountGroup.accounts.extend(Q.sortBy('index', Q.asc)).fetch();
    const existingIndexSet = new Set(existingAccounts.map((account) => account.index));
    const toCreate = indexes.filter((idx) => !existingIndexSet.has(idx));
    if (!toCreate.length) {
      const existing = await accountGroup.accounts.extend(Q.where('index', Q.oneOf(indexes))).fetch();
      return Promise.all(existing.map((a) => this.toInterface(a)));
    }

    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    if (!networks.length) throw new Error('No networks configured.');

    const derived = await this.hardwareWalletService.deriveBsimAccounts(vault.id, toCreate);
    const byIndex = new Map(derived.map((a) => [a.index, a.address]));

    const preparedAccounts: Account[] = [];
    const preparedAddresses: Address[] = [];

    for (const index of toCreate) {
      const address = byIndex.get(index);
      if (!address) throw new Error(`Failed to derive BSIM address for index ${index}.`);

      const nickname = `BSIM Account - ${index + 1}`;
      const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
        record.nickname = nickname;
        record.index = index;
        record.hidden = false;
        record.selected = false;
        record.accountGroup.set(accountGroup);
      });

      const addresses = await this.prepareAddresses(account, networks, async () => address);
      preparedAccounts.push(account);
      preparedAddresses.push(...addresses);
    }

    await this.database.write(async () => {
      await this.database.batch(...preparedAccounts, ...preparedAddresses);
    });

    const finalAccounts = await accountGroup.accounts.extend(Q.where('index', Q.oneOf(indexes)), Q.sortBy('index', Q.asc)).fetch();
    return Promise.all(finalAccounts.map((a) => this.toInterface(a)));
  }

  async applyGroupVisibleIndexes(params: { accountGroupId: string; visibleIndexes: number[]; mnemonic?: string }): Promise<IAccount[]> {
    const accountGroup = await this.database.get<AccountGroup>(TableName.AccountGroup).find(params.accountGroupId);
    const vault = await accountGroup.vault.fetch();
    if (!vault.isGroup) {
      throw new Error('applyGroupVisibleIndexes only supports grouped vaults.');
    }

    const visibleIndexes = Array.from(new Set(params.visibleIndexes)).filter((i) => Number.isInteger(i) && i >= 0);
    visibleIndexes.sort((a, b) => a - b);

    if (!visibleIndexes.length) {
      throw new Error('Keep at least one account.');
    }

    const existingAccounts = await accountGroup.accounts.extend(Q.sortBy('index', Q.asc)).fetch();
    const byIndex = new Map(existingAccounts.map((a) => [a.index, a]));

    const toCreate = visibleIndexes.filter((idx) => !byIndex.has(idx));
    const toShow = existingAccounts.filter((a) => a.hidden && visibleIndexes.includes(a.index));
    const toHide = existingAccounts.filter((a) => !a.hidden && !visibleIndexes.includes(a.index));

    const operations: Array<Account | Address> = [];

    for (const account of toShow) {
      operations.push(account.prepareChangeHidden(false));
    }
    for (const account of toHide) {
      operations.push(account.prepareChangeHidden(true));
    }

    if (toCreate.length) {
      const networks = await this.database.get<Network>(TableName.Network).query().fetch();
      if (!networks.length) throw new Error('No networks configured.');

      if (vault.type === VaultType.HierarchicalDeterministic) {
        const mnemonic = params.mnemonic?.trim() ?? '';
        if (mnemonic === '') throw new Error('Mnemonic is required to create HD accounts.');

        for (const index of toCreate) {
          const nickname = `Account - ${index + 1}`;
          const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
            record.nickname = nickname;
            record.index = index;
            record.hidden = false;
            record.selected = false;
            record.accountGroup.set(accountGroup);
          });

          const addresses = await this.prepareAddresses(account, networks, async (network) => {
            const hdPath = await network.hdPath.fetch();
            const { hexAddress } = await getNthAccountOfHDKey({ mnemonic, hdPath: hdPath.value, nth: index });
            return hexAddress;
          });

          operations.push(account, ...addresses);
        }
      } else if (vault.type === VaultType.BSIM) {
        const derived = await this.hardwareWalletService.deriveBsimAccounts(vault.id, toCreate);
        const derivedByIndex = new Map(derived.map((a) => [a.index, a.address]));

        for (const index of toCreate) {
          const address = derivedByIndex.get(index);
          if (!address) throw new Error(`Failed to derive BSIM address for index ${index}.`);

          const nickname = `BSIM Account - ${index + 1}`;
          const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
            record.nickname = nickname;
            record.index = index;
            record.hidden = false;
            record.selected = false;
            record.accountGroup.set(accountGroup);
          });

          const addresses = await this.prepareAddresses(account, networks, async () => address);
          operations.push(account, ...addresses);
        }
      } else {
        throw new Error(`Vault type ${vault.type} is not supported for account creation.`);
      }
    }

    if (operations.length) {
      await this.database.write(async () => {
        await this.database.batch(...operations);
      });
    }

    const refreshed = await accountGroup.accounts.extend(Q.where('index', Q.oneOf(visibleIndexes)), Q.sortBy('index', Q.asc)).fetch();
    return Promise.all(refreshed.map((a) => this.toInterface(a)));
  }

  private async findAccountGroupByVault(vaultId: string): Promise<{ vault: Vault; accountGroup: AccountGroup }> {
    const vault = await this.database.get<Vault>(TableName.Vault).find(vaultId);
    const accountGroups = await vault.accountGroups.fetch();
    const accountGroup = accountGroups[0];
    if (!accountGroup) {
      throw new Error(`Vault ${vaultId} has no account group.`);
    }
    return { vault, accountGroup };
  }

  private async getCurrentAccountModel(): Promise<Account | null> {
    const accounts = await this.database.get<Account>(TableName.Account).query(Q.where('selected', true)).fetch();

    return accounts[0] ?? null;
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

  private async toInterface(account: Account): Promise<IAccount> {
    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();
    const currentAddress = await account.getCurrentNetworkAddress();
    const addressValue = currentAddress ? await currentAddress.getValue() : '';

    const currentAddressId = currentAddress ? currentAddress.id : null;

    return {
      id: account.id,
      nickname: account.nickname,
      address: addressValue,
      balance: '0', // TODO: integrate AssetService to provide actual balances
      formattedBalance: '0.00', // TODO: integrate AssetService to provide actual balances
      isHardwareWallet: vault.type === VaultType.BSIM,
      vaultType: vault.type,
      accountGroupId: accountGroup.id,
      index: account.index,
      hidden: account.hidden,
      selected: account.selected,
      currentAddressId,
    };
  }
}
