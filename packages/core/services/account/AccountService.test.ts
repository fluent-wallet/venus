import 'reflect-metadata';
import { createTestAccount, DEFAULT_ACCOUNTS_FIXTURE_BASE32, seedNetwork } from '@core/__tests__/fixtures';
import { mockDatabase } from '@core/__tests__/mocks';
import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AssetRule } from '@core/database/models/AssetRule';
import type { Network } from '@core/database/models/Network';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';

import { AccountService } from './AccountService';

describe('AccountService', () => {
  let container: Container;
  let database: Database;
  let service: AccountService;
  let network: Network | undefined;
  let assetRule: AssetRule | undefined;

  beforeEach(async () => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();

    const seeded = await seedNetwork(database, { selected: true });
    network = seeded.network;
    assetRule = seeded.assetRule;

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind(AccountService).toSelf();
    service = container.get(AccountService);
  });

  afterEach(() => {
    container.unbindAll();
    network = undefined;
    assetRule = undefined;
  });

  it('returns null when no account is selected', async () => {
    const account = await service.getCurrentAccount();
    expect(account).toBeNull();
  });

  it('retrieves the currently selected account', async () => {
    const { account: created } = await createTestAccount(database, {
      nickname: 'Primary',
      selected: true,
      network,
      assetRule,
    });

    const account = await service.getCurrentAccount();

    expect(account).not.toBeNull();
    expect(account?.id).toBe(created.id);
    expect(account?.nickname).toBe('Primary');
    expect(account?.address).toBe(DEFAULT_ACCOUNTS_FIXTURE_BASE32);
    expect(account?.isHardwareWallet).toBe(false);
    expect(account?.accountGroupId).toBe(created.accountGroup.id);
    expect(account?.index).toBe(created.index);
    expect(account?.vaultType).toBe(VaultType.HierarchicalDeterministic);
    expect(account?.balance).toBe('0');
    expect(account?.formattedBalance).toBe('0');
    expect(account?.selected).toBe(true);
  });

  it('switches selection between accounts', async () => {
    const { account: first } = await createTestAccount(database, {
      nickname: 'First',
      selected: true,
      network,
      assetRule,
    });
    const { account: second } = await createTestAccount(database, {
      nickname: 'Second',
      selected: false,
      network,
      assetRule,
    });

    await service.switchAccount(second.id);

    const firstRecord = await database.get<Account>(TableName.Account).find(first.id);
    const secondRecord = await database.get<Account>(TableName.Account).find(second.id);

    expect(firstRecord.selected).toBe(false);
    expect(secondRecord.selected).toBe(true);
  });
});
