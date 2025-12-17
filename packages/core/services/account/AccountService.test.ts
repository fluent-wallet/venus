import 'reflect-metadata';
import { createTestAccount, DEFAULT_ACCOUNTS_FIXTURE_BASE32, seedNetwork } from '@core/__tests__/fixtures';
import { createMockHardwareWallet, mockDatabase } from '@core/__tests__/mocks';
import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { AssetRule } from '@core/database/models/AssetRule';
import type { Network } from '@core/database/models/Network';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import { type ChainType, NetworkType } from '@core/types';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';
import { HardwareWalletService, registerServices, VaultService } from '..';
import { AccountService } from './AccountService';

class FakeCryptoTool implements ICryptoTool {
  async encrypt(data: unknown): Promise<string> {
    return JSON.stringify({ payload: data });
  }
  async decrypt<T = unknown>(encryptedString: string): Promise<T> {
    return (JSON.parse(encryptedString) as { payload: T }).payload;
  }
  setGetPasswordMethod(): void {}
  async getPassword(): Promise<string | null> {
    return null;
  }
  generateRandomString(): string {
    return 'stub';
  }
}

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
    container.bind(HardwareWalletService).toConstantValue({
      syncDerivedAccounts: jest.fn(async () => undefined),
    } as unknown as HardwareWalletService);

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
    expect(account?.formattedBalance).toBe('0.00');
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

  it('finds account by id or returns null', async () => {
    const { account } = await createTestAccount(database, { network, assetRule });
    const found = await service.getAccountById(account.id);
    expect(found?.id).toBe(account.id);

    const missing = await service.getAccountById('non-existent');
    expect(missing).toBeNull();
  });

  it('lists accounts with optional hidden filter', async () => {
    await createTestAccount(database, { nickname: 'Visible', hidden: false, network, assetRule });
    await createTestAccount(database, { nickname: 'Hidden', hidden: true, network, assetRule });

    const visibleOnly = await service.listAccounts();
    expect(visibleOnly).toHaveLength(1);
    expect(visibleOnly[0].nickname).toBe('Visible');

    const includeHidden = await service.listAccounts({ includeHidden: true });
    expect(includeHidden).toHaveLength(2);
  });

  it('retrieves accounts by group id', async () => {
    const { accountGroup } = await createTestAccount(database, { nickname: 'GroupMember', network, assetRule });
    await createTestAccount(database, { nickname: 'OtherGroup', network, assetRule });

    const result = await service.getAccountsByGroup(accountGroup.id);
    expect(result).toHaveLength(1);
    expect(result[0].nickname).toBe('GroupMember');
  });

  it('updates account nickname with trimming', async () => {
    const { account } = await createTestAccount(database, { nickname: 'Old', network, assetRule });

    const updated = await service.updateAccountNickName(account.id, '  NewName  ');
    expect(updated.nickname).toBe('NewName');

    const record = await database.get<Account>(TableName.Account).find(account.id);
    expect(record.nickname).toBe('NewName');
  });

  it('throws when hiding the last visible account', async () => {
    const { account } = await createTestAccount(database, { hidden: false, network, assetRule });

    await expect(service.setAccountHidden(account.id, true)).rejects.toThrow('Keep at least one account.');
  });

  it('toggles account hidden flag when group still has visible accounts', async () => {
    const { account, accountGroup } = await createTestAccount(database, { hidden: false, network, assetRule });

    await database.write(async () => {
      await database.get<Account>(TableName.Account).create((record) => {
        record.nickname = 'Sibling';
        record.index = account.index + 1;
        record.hidden = false;
        record.selected = false;
        record.accountGroup.set(accountGroup);
      });
    });

    const updated = await service.setAccountHidden(account.id, true);
    expect(updated.hidden).toBe(true);

    const record = await database.get<Account>(TableName.Account).find(account.id);
    expect(record.hidden).toBe(true);
  });

  it('batch updates account visibility', async () => {
    const first = await createTestAccount(database, { nickname: 'A', hidden: false, network, assetRule });

    let secondAccount!: Account;
    await database.write(async () => {
      secondAccount = await database.get<Account>(TableName.Account).create((record) => {
        record.nickname = 'B';
        record.index = first.account.index + 1;
        record.hidden = true;
        record.selected = false;
        record.accountGroup.set(first.accountGroup);
      });
    });

    if (!secondAccount) {
      throw new Error('Failed to create second account');
    }
    const result = await service.batchSetVisibility([
      { accountId: first.account.id, hidden: true },
      { accountId: secondAccount.id, hidden: false },
    ]);

    expect(result).toHaveLength(2);

    const firstRecord = await database.get<Account>(TableName.Account).find(first.account.id);
    const secondRecord = await database.get<Account>(TableName.Account).find(secondAccount.id);
    expect(firstRecord.hidden).toBe(true);
    expect(secondRecord.hidden).toBe(false);
  });

  it('does nothing when switching to already selected account', async () => {
    const { account } = await createTestAccount(database, { selected: true, network, assetRule });
    await expect(service.switchAccount(account.id)).resolves.toBeUndefined();
    const record = await database.get<Account>(TableName.Account).find(account.id);
    expect(record.selected).toBe(true);
  });

  it('returns empty array when batchSetVisibility receives no changes', async () => {
    const result = await service.batchSetVisibility([]);
    expect(result).toEqual([]);
  });

  it('prevents batch hiding the last visible account', async () => {
    const { account } = await createTestAccount(database, { hidden: false, network, assetRule });
    await expect(service.batchSetVisibility([{ accountId: account.id, hidden: true }])).rejects.toThrow('Keep at least one account.');
  });
});

describe('AccountService hardware accounts', () => {
  let container: Container;
  let database: Database;

  beforeEach(async () => {
    container = new Container({ defaultScope: 'Singleton' });
    database = mockDatabase();

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind<ICryptoTool>(SERVICE_IDENTIFIER.CRYPTO_TOOL).toConstantValue(new FakeCryptoTool());

    registerServices(container);

    await seedNetwork(database, { selected: true });
  });

  afterEach(() => {
    container.unbindAll();
  });

  it('creates additional BSIM accounts without changing selection', async () => {
    const vaultService = container.get(VaultService);
    const accountService = container.get(AccountService);
    const hardwareRegistry = container.get(HardwareWalletRegistry);

    const adapter = createMockHardwareWallet();

    const buildHexAddress = (index: number) => `0x${'deadbeef'.repeat(4)}${index.toString(16).padStart(8, '0')}`;

    adapter.deriveAccount.mockImplementation(async (index: number, _chainType: ChainType) => ({
      index,
      chainType: NetworkType.Ethereum,
      address: buildHexAddress(index),
      derivationPath: `m/44'/60'/0'/0/${index}`,
    }));

    hardwareRegistry.register(HARDWARE_WALLET_TYPES.BSIM, 'mock-device', adapter);

    const vault = await vaultService.createBSIMVault({
      accounts: [{ index: 0, hexAddress: '0x0b3F5420B534B86617c26F35192fb437672CF273' }],
      hardwareDeviceId: 'mock-device',
    });

    const created = await accountService.createHardwareAccounts(vault.id, 2);

    expect(created.length).toBeGreaterThanOrEqual(1);
    const all = await database.get<Account>(TableName.Account).query().fetch();

    const selectedCount = all.filter((account) => account.selected).length;
    expect(selectedCount).toBe(1);

    const newOnes = all.filter((account) => account.index === 1 || account.index === 2);
    expect(newOnes.every((account) => account.selected === false)).toBe(true);
  });
});
