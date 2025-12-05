import 'reflect-metadata';
import { seedNetwork } from '@core/__tests__/fixtures';
import { mockDatabase } from '@core/__tests__/mocks';
import type { Database } from '@core/database';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';
import { VaultService } from './VaultService';

const TEST_PASSWORD = 'test-password';
const FIXED_MNEMONIC = 'test test test test test test test test test test test junk';

class FakeCryptoTool implements ICryptoTool {
  private passwordGetter: (() => string | null) | null = null;

  async encrypt(data: unknown, password?: string): Promise<string> {
    return JSON.stringify({ payload: data, password: password ?? null });
  }

  async decrypt<T = unknown>(encryptedString: string, password?: string): Promise<T> {
    const parsed = JSON.parse(encryptedString) as { payload: T; password: string | null };
    const expected = password ?? null;

    if (parsed.password !== expected) {
      throw new Error('Invalid password');
    }

    return parsed.payload;
  }

  setGetPasswordMethod(getPasswordMethod: () => string | null): void {
    this.passwordGetter = getPasswordMethod;
  }

  async getPassword(): Promise<string | null> {
    return this.passwordGetter?.() ?? null;
  }

  generateRandomString(): string {
    return 'stub';
  }
}

describe('VaultService', () => {
  let container: Container;
  let database: Database;
  let service: VaultService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind<ICryptoTool>(SERVICE_IDENTIFIER.CRYPTO_TOOL).toConstantValue(new FakeCryptoTool());
    container.bind(VaultService).toSelf();

    service = container.get(VaultService);
  });

  afterEach(() => {
    container.unbindAll();
  });

  const fetchFirstAddress = async () => {
    const records = await database.get<Address>(TableName.Address).query().fetch();
    if (!records[0]) {
      throw new Error('No address found');
    }
    return records[0];
  };

  const fetchFirstAddressByGroup = async (accountGroupId: string) => {
    const group = await database.get<AccountGroup>(TableName.AccountGroup).find(accountGroupId);
    const accounts = await group.accounts.fetch();
    const firstAccount = accounts[0];
    if (!firstAccount) {
      throw new Error('No account found');
    }
    const addresses = await firstAccount.addresses.fetch();
    if (!addresses[0]) {
      throw new Error('No address found');
    }
    return addresses[0];
  };

  it('creates HD vault and handles mnemonic/private key', async () => {
    await seedNetwork(database, { selected: true });

    // Create vault
    const vault = await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });
    expect(vault.type).toBe(VaultType.HierarchicalDeterministic);
    expect(vault.isBackup).toBe(true);

    // Get mnemonic
    const mnemonic = await service.getMnemonic(vault.id, TEST_PASSWORD);
    expect(mnemonic).toBe(FIXED_MNEMONIC);

    // Derive private key
    const address = await fetchFirstAddress();
    const network = await address.network.fetch();
    const hdPath = await network.hdPath.fetch();

    const expected = await getNthAccountOfHDKey({
      mnemonic: FIXED_MNEMONIC,
      hdPath: hdPath.value,
      nth: 0,
    });

    const privateKey = await service.getPrivateKey(vault.id, address.id, TEST_PASSWORD);
    expect(privateKey).toBe(expected.privateKey);
  });

  it('handles PrivateKey vault', async () => {
    await seedNetwork(database, { selected: true });
    const privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const vault = await service.createPrivateKeyVault({
      privateKey,
      password: TEST_PASSWORD,
    });

    const address = await fetchFirstAddress();
    const decrypted = await service.getPrivateKey(vault.id, address.id, TEST_PASSWORD);
    expect(decrypted).toBe(privateKey);
  });

  it('validates vault operations', async () => {
    // No networks configured
    await expect(service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD })).rejects.toThrow('No networks configured');

    // Setup network for remaining tests
    await seedNetwork(database, { selected: true });
    const hdVault = await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });

    // Wrong password
    await expect(service.getMnemonic(hdVault.id, 'wrong-password')).rejects.toThrow('Invalid password');

    // Non-HD vault mnemonic access
    const privateKeyVault = await service.createPrivateKeyVault({
      privateKey: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      password: TEST_PASSWORD,
    });
    await expect(service.getMnemonic(privateKeyVault.id, TEST_PASSWORD)).rejects.toThrow('only available for HD vaults');

    // Cross-vault private key access
    const otherPkVault = await service.createPrivateKeyVault({
      privateKey: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      password: TEST_PASSWORD,
    });
    const otherPkAddress = await fetchFirstAddressByGroup(otherPkVault.accountGroupId);
    await expect(service.getPrivateKey(hdVault.id, otherPkAddress.id, TEST_PASSWORD)).rejects.toThrow('does not belong to the provided vault');

    // Hardware wallet private key export
    const bsimVault = await service.createBSIMVault({
      accounts: [{ index: 0, hexAddress: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' }],
    });
    const bsimAddress = await fetchFirstAddressByGroup(bsimVault.accountGroupId);
    await expect(service.getPrivateKey(bsimVault.id, bsimAddress.id, TEST_PASSWORD)).rejects.toThrow(/does not expose a private key/i);
  });
  it('handles vault and account naming', async () => {
    await seedNetwork(database, { selected: true });

    // First vault with default naming
    const vault1 = await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });
    const group1 = await database.get<AccountGroup>(TableName.AccountGroup).find(vault1.accountGroupId);
    const accounts1 = await group1.accounts.fetch();

    expect(group1.nickname).toBe('Seed Phrase - 1');
    expect(accounts1[0].nickname).toBe('Account - 1');

    // Second vault with custom account name
    const vault2 = await service.createHDVault({
      mnemonic: FIXED_MNEMONIC,
      password: TEST_PASSWORD,
      accountNickname: 'My Custom Account',
    });
    const group2 = await database.get<AccountGroup>(TableName.AccountGroup).find(vault2.accountGroupId);
    const accounts2 = await group2.accounts.fetch();

    expect(group2.nickname).toBe('Seed Phrase - 2');
    expect(accounts2[0].nickname).toBe('My Custom Account');
  });

  it('creates BSIM vault with multiple accounts', async () => {
    await seedNetwork(database, { selected: true });

    const accountsInput = [
      { index: 0, hexAddress: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' },
      { index: 5, hexAddress: '0x763d0F4D817e65ec6ac7224AeA281F1282Edc3B7' },
    ];

    const vault = await service.createBSIMVault({ accounts: accountsInput, hardwareDeviceId: 'icc-123' });
    expect(vault.type).toBe(VaultType.BSIM);
    expect(vault.hardwareDeviceId).toBe('icc-123');
    const group = await database.get<AccountGroup>(TableName.AccountGroup).find(vault.accountGroupId);
    const accounts = await group.accounts.fetch();
    const sorted = [...accounts].sort((a, b) => a.index - b.index);

    expect(sorted).toHaveLength(2);
    expect(sorted[0].nickname).toBe('BSIM Account - 1');
    expect(sorted[0].index).toBe(0);
    expect(sorted[1].nickname).toBe('BSIM Account - 2');
    expect(sorted[1].index).toBe(5);
    expect(sorted[0].selected).toBe(true);
    expect(sorted[1].selected).toBe(false);

    const firstAddress = await fetchFirstAddress();
    await expect(service.getPrivateKey(vault.id, firstAddress.id, TEST_PASSWORD)).rejects.toThrow(/does not expose/i);
  });

  it('rejects BSIM vault without accounts', async () => {
    await expect(service.createBSIMVault({ accounts: [] })).rejects.toThrow('BSIM vault requires at least one account.');
  });

  it('creates PublicAddress vault and blocks private key export', async () => {
    await seedNetwork(database, { selected: true });

    const watchAddress = '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD';
    const vault = await service.createPublicAddressVault({ hexAddress: watchAddress });

    expect(vault.type).toBe(VaultType.PublicAddress);
    const group = await database.get<AccountGroup>(TableName.AccountGroup).find(vault.accountGroupId);
    const accounts = await group.accounts.fetch();
    expect(accounts[0]?.nickname).toBe('Watch Account - 1');

    const address = await fetchFirstAddress();
    await expect(service.getPrivateKey(vault.id, address.id, TEST_PASSWORD)).rejects.toThrow(/does not expose/i);
  });
});
