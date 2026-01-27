import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Vault } from '@core/database/models/Vault';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable, optional } from 'inversify';
import { HardwareWalletService } from '../hardware/HardwareWalletService';
import type { IAccount } from './types';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';

@injectable()
export class AccountService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

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
      .query(...conditions)
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
  private async toInterface(account: Account): Promise<IAccount> {
    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();
    const currentAddress = await account.currentNetworkAddress;
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
