import 'reflect-metadata';
import type { Database } from '@core/database';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { AddressBook } from '@core/database/models/AddressBook';
import { AddressType } from '@core/database/models/AddressBook';
import type { App } from '@core/database/models/App';
import type { Permission } from '@core/database/models/Permission';
import { Permissions } from '@core/database/models/Permission';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxSource, TxStatus } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import { VaultType } from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { seedNetwork } from '@core/testUtils/fixtures';
import { createStrictTestCryptoTool, mockDatabase } from '@core/testUtils/mocks';
import type { CryptoTool } from '@core/types/crypto';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import { Container } from 'inversify';
import { HardwareWalletService } from '../hardware/HardwareWalletService';
import { VaultService } from './VaultService';

const TEST_PASSWORD = 'test-password';
const FIXED_MNEMONIC = 'test test test test test test test test test test test junk';

describe('VaultService', () => {
  let container: Container;
  let database: Database;
  let service: VaultService;
  let hardwareWalletService: { connectAndSync: jest.Mock };

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();

    container.bind(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind<CryptoTool>(CORE_IDENTIFIERS.CRYPTO_TOOL).toConstantValue(createStrictTestCryptoTool());
    hardwareWalletService = {
      connectAndSync: jest.fn(async () => {
        throw new Error('connectAndSync should not be called in this test.');
      }),
    };
    container.bind(HardwareWalletService).toConstantValue(hardwareWalletService as unknown as HardwareWalletService);
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

  it('imports only the first BSIM account when accounts are omitted', async () => {
    await seedNetwork(database, { selected: true });

    hardwareWalletService.connectAndSync.mockResolvedValue({
      accounts: [
        { index: 5, address: '0x763d0F4D817e65ec6ac7224AeA281F1282Edc3B7' },
        { index: 0, address: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' },
      ],
      deviceId: 'icc-xyz',
    });

    const vault = await service.createBSIMVault({ connectOptions: { deviceIdentifier: 'ignored-for-apdu' } });
    const group = await database.get<AccountGroup>(TableName.AccountGroup).find(vault.accountGroupId);
    const accounts = await group.accounts.fetch();

    expect(hardwareWalletService.connectAndSync).toHaveBeenCalledTimes(1);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.index).toBe(0);
    expect(accounts[0]?.selected).toBe(true);
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

  it('deletes vaults with related account records in a single batch', async () => {
    await seedNetwork(database, { selected: true });

    const vault = await service.createPublicAddressVault({ hexAddress: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' });
    const address = await fetchFirstAddressByGroup(vault.accountGroupId);
    const account = await address.account.fetch();
    const network = await address.network.fetch();

    await database.write(async () => {
      const app = await database.get<App>(TableName.App).create((record) => {
        record.identity = 'wc:test';
        record.origin = 'https://example.com';
        record.name = 'Example';
        record.icon = 'https://example.com/icon.png';
      });

      await database.get<Permission>(TableName.Permission).create((record) => {
        record.type = Permissions.Accounts;
        record.rule = '[]';
        record.app.set(app);
        record.network.set(network);
        record.account.set(account);
      });

      const txPayload = await database.get<TxPayload>(TableName.TxPayload).create((record) => {
        record.type = 'legacy';
        record.accessList = null;
        record.maxFeePerGas = null;
        record.maxPriorityFeePerGas = null;
        record.from = address.hex;
        record.to = '0x0000000000000000000000000000000000000001';
        record.gasPrice = '1';
        record.gasLimit = '21000';
        record.storageLimit = null;
        record.data = '0x';
        record.value = '1';
        record.nonce = 0;
        record.chainId = network.chainId;
        record.epochHeight = null;
      });

      const txExtra = await database.get<TxExtra>(TableName.TxExtra).create((record) => {
        record.ok = true;
        record.contractCreation = false;
        record.simple = true;
        record.sendAction = null;
        record.contractInteraction = false;
        record.token20 = false;
        record.tokenNft = false;
        record.address = address.hex;
        record.method = 'transfer';
      });

      const tx = await database.get<Tx>(TableName.Tx).create((record) => {
        record.raw = null;
        record.hash = '0xhash';
        record.status = TxStatus.PENDING;
        record.executedStatus = null;
        record.receipt = null;
        record.executedAt = null;
        record.errorType = null;
        record.err = null;
        record.sendAt = new Date();
        record.resendAt = null;
        record.resendCount = 0;
        record.pollingCount = 0;
        record.confirmedNumber = 0;
        record.isTempReplacedByInner = false;
        record.source = TxSource.SELF;
        record.method = 'transfer';
        record.address.set(address);
        record.txExtra.set(txExtra);
        record.txPayload.set(txPayload);
      });

      await database.get<Signature>(TableName.Signature).create((record) => {
        record.signType = SignType.TX;
        record.message = '0x';
        record.blockNumber = '0';
        record.app.set(app);
        record.address.set(address);
        record.tx.set(tx);
      });

      await database.get<AddressBook>(TableName.AddressBook).create((record) => {
        record.name = 'Friend';
        record.addressValue = '0x0000000000000000000000000000000000000002';
        record.type = AddressType.EOA;
        record.account.set(address);
        record.network.set(network);
      });
    });

    await expect(service.deleteVault(vault.id)).resolves.toBeUndefined();

    await expect(database.get(TableName.Vault).find(vault.id)).rejects.toThrow();
    await expect(database.get(TableName.AccountGroup).find(vault.accountGroupId)).rejects.toThrow();
    await expect(database.get(TableName.Account).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.Address).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.Permission).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.Tx).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.TxPayload).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.TxExtra).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.Signature).query().fetch()).resolves.toHaveLength(0);
    await expect(database.get(TableName.AddressBook).query().fetch()).resolves.toHaveLength(0);
  });

  it('deduplicates imports by secret value within the same vault type', async () => {
    await seedNetwork(database, { selected: true });

    await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });
    await expect(service.hasExistingSecretImport({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD })).resolves.toBe(true);

    const privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    await service.createPrivateKeyVault({ privateKey, password: TEST_PASSWORD });
    await expect(service.hasExistingSecretImport({ privateKey, password: TEST_PASSWORD })).resolves.toBe(true);
  });

  it('does not treat address overlap across vault types as a duplicate import', async () => {
    const { network } = await seedNetwork(database, { selected: true });
    const hdPath = await network.hdPath.fetch();

    const firstHdAccount = await getNthAccountOfHDKey({
      mnemonic: FIXED_MNEMONIC,
      hdPath: hdPath.value,
      nth: 0,
    });

    await service.createPrivateKeyVault({ privateKey: firstHdAccount.privateKey, password: TEST_PASSWORD });

    await expect(service.hasExistingSecretImport({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD })).resolves.toBe(false);
  });

  it('verifies password against existing vault secrets', async () => {
    await seedNetwork(database, { selected: true });
    await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: TEST_PASSWORD });

    await expect(service.verifyPassword(TEST_PASSWORD)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong-password')).resolves.toBe(false);
  });

  it('verifies password for BSIM-only vaults using legacy encrypted marker', async () => {
    await seedNetwork(database, { selected: true });

    await service.createBSIMVault({
      accounts: [{ index: 0, hexAddress: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' }],
      password: TEST_PASSWORD,
    });

    await expect(service.verifyPassword(TEST_PASSWORD)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong-password')).resolves.toBe(false);
  });

  it('prefers HD/PK secrets over BSIM marker when verifying password', async () => {
    await seedNetwork(database, { selected: true });

    await service.createHDVault({ mnemonic: FIXED_MNEMONIC, password: 'hd-pass' });
    await service.createBSIMVault({
      accounts: [{ index: 0, hexAddress: '0x50bb3047BA3E60Ca750728de9F737085F2Ac2aCD' }],
      password: 'bsim-pass',
    });

    await expect(service.verifyPassword('hd-pass')).resolves.toBe(true);
    await expect(service.verifyPassword('bsim-pass')).resolves.toBe(false);
  });
});
