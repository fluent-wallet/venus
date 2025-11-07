import 'reflect-metadata';
import { createTestAccount, seedNetwork } from '@core/__tests__/fixtures';
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
    const { vault, address } = await createTestAccount(database, { vaultType: VaultType.PrivateKey });
    const encrypted = await container.get<ICryptoTool>(SERVICE_IDENTIFIER.CRYPTO_TOOL).encrypt('0xabcdef', TEST_PASSWORD);

    await database.write(async () => {
      await vault.update((record) => {
        record.data = encrypted;
      });
    });

    const privateKey = await service.getPrivateKey(vault.id, address.id, TEST_PASSWORD);
    expect(privateKey).toBe('0xabcdef');
  });

  it('validates vault operations', async () => {
    // No networks configured
    await expect(service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD })).rejects.toThrow('No networks configured');

    // Setup network for remaining tests
    await seedNetwork(database, { selected: true });
    const vault = await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });

    // Wrong password
    await expect(service.getMnemonic(vault.id, 'wrong-password')).rejects.toThrow('Invalid password');

    // Non-HD vault mnemonic access
    const { vault: pkVault } = await createTestAccount(database, { vaultType: VaultType.PrivateKey });
    await expect(service.getMnemonic(pkVault.id, TEST_PASSWORD)).rejects.toThrow('only available for HD vaults');

    // Cross-vault private key access
    const { address: pkAddress } = await createTestAccount(database, { vaultType: VaultType.PrivateKey });
    await expect(service.getPrivateKey(vault.id, pkAddress.id, TEST_PASSWORD)).rejects.toThrow('does not belong to the provided vault');

    // Hardware wallet private key export
    const { vault: bsimVault, address: bsimAddress } = await createTestAccount(database, { vaultType: VaultType.BSIM });
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
});
