import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Vault } from '@core/database/models/Vault';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable } from 'inversify';
import type { IAccountGroup } from './types';

@injectable()
export class AccountGroupService {
  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  async listGroups(options: { includeHidden?: boolean } = {}): Promise<IAccountGroup[]> {
    const groups = await this.database.get<AccountGroup>(TableName.AccountGroup).query().fetch();
    const result: IAccountGroup[] = [];

    for (const group of groups) {
      const snapshot = await this.toInterface(group, options);
      if (!snapshot) continue;
      result.push(snapshot);
    }

    return result;
  }

  async getGroup(groupId: string, options: { includeHidden?: boolean } = {}): Promise<IAccountGroup | null> {
    try {
      const group = await this.database.get<AccountGroup>(TableName.AccountGroup).find(groupId);
      return (await this.toInterface(group, options)) ?? null;
    } catch {
      return null;
    }
  }

  async updateGroupNickname(groupId: string, nickname: string): Promise<IAccountGroup> {
    const trimmed = nickname.trim();
    if (trimmed === '') throw new Error('Group nickname cannot be empty.');

    const group = await this.findGroupOrThrow(groupId);
    await group.updateName(trimmed);

    const updated = await this.getGroup(group.id, { includeHidden: true });
    if (!updated) throw new Error('Failed to read updated group.');
    return updated;
  }

  async getLastAccountIndex(groupId: string): Promise<number> {
    const accounts = await this.database.get<Account>(TableName.Account).query(Q.where('account_group_id', groupId), Q.sortBy('index', Q.desc)).fetch();
    return accounts[0]?.index ?? -1;
  }

  private async findGroupOrThrow(groupId: string): Promise<AccountGroup> {
    try {
      return await this.database.get<AccountGroup>(TableName.AccountGroup).find(groupId);
    } catch {
      throw new Error(`AccountGroup ${groupId} not found.`);
    }
  }

  private async toInterface(group: AccountGroup, options: { includeHidden?: boolean } = {}): Promise<IAccountGroup | null> {
    let vault: Vault;
    try {
      vault = await group.vault.fetch();
    } catch {
      return null;
    }

    const accounts = await group.accounts.fetch();
    const accountCount = accounts.length;
    const visibleAccountCount = options.includeHidden ? accountCount : accounts.filter((a) => !a.hidden).length;
    const lastAccountIndex = accounts.reduce((max, account) => (account.index > max ? account.index : max), -1);

    return {
      id: group.id,
      nickname: group.nickname,
      vaultId: vault.id,
      vaultType: vault.type,
      vaultSource: vault.source,
      isBackup: vault.isBackup,
      isGroup: vault.isGroup,
      hardwareDeviceId: vault.hardwareDeviceId ?? null,
      accountCount,
      visibleAccountCount,
      lastAccountIndex,
    };
  }
}
