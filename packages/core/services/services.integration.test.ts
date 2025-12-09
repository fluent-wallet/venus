import 'reflect-metadata';

import { seedNetwork } from '@core/__tests__/fixtures';
import { StubChainProvider } from '@core/__tests__/mocks/chainProviders';
import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import { mockDatabase } from '@core/database/__tests__/mockDatabases';
import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { Asset as DbAsset } from '@core/database/models/Asset';
import { AssetSource, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { AccountService, AssetService, registerServices, type SendTransactionInput, SigningService, TransactionService, VaultService } from '@core/services';
import { AssetType, TxStatus as ServiceTxStatus } from '@core/types';
import { convertHexToBase32 } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import { getNthAccountOfHDKey } from '@core/utils/hdkey';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';

const TEST_PASSWORD = 'test-password';
const FIXED_MNEMONIC = 'test test test test test test test test test test test junk';

class FakeCryptoTool implements ICryptoTool {
  private passwordGetter: (() => string | null) | null = null;

  async encrypt(data: unknown, password?: string): Promise<string> {
    return JSON.stringify({ payload: data, password: password ?? null });
  }

  async decrypt<T = unknown>(encryptedString: string, password?: string): Promise<T> {
    const parsed = JSON.parse(encryptedString) as { payload: T; password: string | null };

    if (password !== undefined) {
      const expected = password ?? null;
      if (parsed.password !== expected) {
        throw new Error('Invalid password');
      }
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

describe('Service integration', () => {
  let container: Container;
  let database: Database;

  beforeEach(async () => {
    container = new Container({ defaultScope: 'Singleton' });
    database = mockDatabase();

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind<ICryptoTool>(SERVICE_IDENTIFIER.CRYPTO_TOOL).toConstantValue(new FakeCryptoTool());

    registerServices(container);

    container.bind(ChainRegistry).toSelf().inSingletonScope();

    await seedNetwork(database, { selected: true });
  });

  afterEach(() => {
    container.unbindAll();
  });

  it('creates HD vault, selects current account and derives address correctly', async () => {
    const vaultService = container.get(VaultService);
    const accountService = container.get(AccountService);

    const vault = await vaultService.createHDVault({
      mnemonic: FIXED_MNEMONIC,
      password: TEST_PASSWORD,
    });

    expect(vault.type).toBe(VaultType.HierarchicalDeterministic);
    expect(vault.isBackup).toBe(true);

    const currentAccount = await accountService.getCurrentAccount();
    expect(currentAccount).not.toBeNull();

    const account = currentAccount!;
    expect(account.vaultType).toBe(VaultType.HierarchicalDeterministic);
    expect(account.accountGroupId).toBe(vault.accountGroupId);
    expect(account.selected).toBe(true);

    const accounts = await database.get<Account>(TableName.Account).query().fetch();
    expect(accounts).toHaveLength(1);
    const dbAccount = accounts[0];

    const groups = await database.get<AccountGroup>(TableName.AccountGroup).query().fetch();
    expect(groups).toHaveLength(1);
    const dbGroup = groups[0];

    expect(dbAccount.accountGroup.id).toBe(dbGroup.id);
    expect(dbAccount.index).toBe(0);

    const addresses = await database.get<Address>(TableName.Address).query().fetch();
    expect(addresses).toHaveLength(1);
    const dbAddress = addresses[0];

    const network = await dbAddress.network.fetch();
    const hdPath = await network.hdPath.fetch();

    const { hexAddress } = await getNthAccountOfHDKey({
      mnemonic: FIXED_MNEMONIC,
      hdPath: hdPath.value,
      nth: 0,
    });

    const expectedHex = hexAddress.toLowerCase();
    expect(dbAddress.hex.toLowerCase()).toBe(expectedHex);

    if (network.networkType === NetworkType.Conflux) {
      const expectedBase32 = convertHexToBase32(dbAddress.hex, network.netId);
      expect(dbAddress.base32).toBe(expectedBase32);

      expect(await dbAddress.getValue()).toBe(expectedBase32);
      expect(account.address).toBe(expectedBase32);
    } else {
      expect(await dbAddress.getValue()).toBe(dbAddress.hex);
      expect(account.address.toLowerCase()).toBe(dbAddress.hex.toLowerCase());
    }
  });

  it('builds, signs and broadcasts a native transaction end-to-end', async () => {
    const vaultService = container.get(VaultService);
    const txService = container.get(TransactionService);
    const signingService = container.get(SigningService);
    const chainRegistry = container.get(ChainRegistry);

    // 1. Create HD vault
    await vaultService.createHDVault({
      mnemonic: FIXED_MNEMONIC,
      password: TEST_PASSWORD,
    });

    const accounts = await database.get<Account>(TableName.Account).query().fetch();
    expect(accounts).toHaveLength(1);
    const dbAccount = accounts[0];

    const addresses = await database.get<Address>(TableName.Address).query().fetch();
    expect(addresses).toHaveLength(1);
    const dbAddress = addresses[0];

    const network = await dbAddress.network.fetch();

    // 2. Register a StubChainProvider in ChainRegistry
    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    // 3. Ensure SigningService can resolve a signer for this account/address
    const signer = await signingService.getSigner(dbAccount.id, dbAddress.id);
    expect(signer.type).toBe('software');

    // 4. Build input and send native transaction through TransactionService
    const input: SendTransactionInput = {
      addressId: dbAddress.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1.0',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    const result = await txService.sendNative(input);

    // 5. Validate returned ITransaction view
    expect(result.networkId).toBe(network.id);
    expect(result.status).toBe(ServiceTxStatus.Pending);
    expect(result.hash).toBe('0xhash'); // from StubChainProvider
    expect(result.from).toBe(await dbAddress.getValue());
    expect(result.to).toBe(input.to);

    // 6. Validate Tx record in database
    const txs = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(txs).toHaveLength(1);
    const tx = txs[0];

    expect(tx.hash).toBe('0xhash');

    const txPayload = await tx.txPayload.fetch();
    expect(txPayload.from).toBe(await dbAddress.getValue());
    expect(txPayload.to).toBe(input.to);
    expect(txPayload.chainId).toBe(network.chainId);
  });

  it('queries asset balances via AssetService and ChainRegistry', async () => {
    const vaultService = container.get(VaultService);
    const assetService = container.get(AssetService);
    const chainRegistry = container.get(ChainRegistry);

    // 1. Create HD vault so we have one address bound to the seeded network
    await vaultService.createHDVault({
      mnemonic: FIXED_MNEMONIC,
      password: TEST_PASSWORD,
    });

    const addresses = await database.get<Address>(TableName.Address).query().fetch();
    expect(addresses).toHaveLength(1);
    const dbAddress = addresses[0];

    const network = await dbAddress.network.fetch();
    const assetRule = await dbAddress.assetRule.fetch();

    // 2. Create one native asset and one ERC20 asset for this asset rule
    const tokenContract = 'cfxtest:mockerc20token000000000000000000000000';

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.assetRule.set(assetRule);
        record.network.set(network);
        record.type = DbAssetType.Native;
        record.contractAddress = '';
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.source = AssetSource.Official;
        record.priceInUSDT = '1';
      });

      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.assetRule.set(assetRule);
        record.network.set(network);
        record.type = DbAssetType.ERC20;
        record.contractAddress = tokenContract;
        record.name = 'MockToken';
        record.symbol = 'MCK';
        record.decimals = 18;
        record.icon = null;
        record.source = AssetSource.Custom;
        record.priceInUSDT = null;
      });
    });

    // 3. Register StubChainProvider and seed balances
    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });

    const addressValue = await dbAddress.getValue();
    provider.setNativeBalance(addressValue, '0xde0b6b3a7640000'); // 1.0 with 18 decimals
    provider.setTokenBalance(tokenContract, '0x1bc16d674ec80000'); // 2.0 with 18 decimals

    chainRegistry.register(provider);

    // 4. Query assets via AssetService
    const assets = await assetService.getAssetsByAddress(dbAddress.id);

    expect(assets).toHaveLength(2);
    const native = assets.find((item) => item.type === DbAssetType.Native);
    const token = assets.find((item) => item.type === DbAssetType.ERC20);

    expect(native).toBeDefined();
    expect(token).toBeDefined();

    // Native asset: 1 * price 1 = 1
    expect(native!.balance).toBe('1');
    expect(native!.formattedBalance).toBe('1');
    expect(native!.priceValue).toBe('1');

    // Token asset: 2, no price
    expect(token!.balance).toBe('2');
    expect(token!.formattedBalance).toBe('2');
    expect(token!.priceValue).toBeNull();
  });
});
