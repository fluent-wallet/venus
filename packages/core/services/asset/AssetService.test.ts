import 'reflect-metadata';
import { ChainRegistry } from '@core/chains';
import { iface777 } from '@core/contracts';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { mockDatabase } from '@core/database/testUtils/mockDatabases';
import { CORE_IDENTIFIERS } from '@core/di';
import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { StubChainProvider } from '@core/testUtils/mocks/chainProviders';
import type { Hex } from '@core/types';
import { Container } from 'inversify';
import { AssetService } from './AssetService';

describe('AssetService', () => {
  let container: Container;
  let database: Database;
  let registry: ChainRegistry;
  let service: AssetService;
  let provider: StubChainProvider;
  let network: Network;
  let assetRuleId: string;
  let address: Address;
  let nativeAsset: Asset;
  let tokenAsset: Asset;
  const tokenContract = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';

  beforeEach(async () => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    registry = new ChainRegistry();

    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(AssetService).toSelf();

    const seeded = await seedNetwork(database, { definitionKey: 'Conflux Testnet', selected: true });
    network = seeded.network;
    assetRuleId = seeded.assetRule.id;

    const { address: createdAddress } = await createTestAccount(database, {
      network,
      assetRule: seeded.assetRule,
      selected: true,
    });
    address = createdAddress;

    const addressValue = await address.getValue();

    await database.write(async () => {
      nativeAsset = await database.get<Asset>(TableName.Asset).create((record) => {
        record.assetRule.set(seeded.assetRule);
        record.network.set(network);
        record.type = AssetType.Native;
        record.contractAddress = '';
        record.name = 'Conflux';
        record.symbol = 'CFX';
        record.decimals = 18;
        record.icon = null;
        record.source = AssetSource.Official;
        record.priceInUSDT = '1';
      });

      tokenAsset = await database.get<Asset>(TableName.Asset).create((record) => {
        record.assetRule.set(seeded.assetRule);
        record.network.set(network);
        record.type = AssetType.ERC20;
        record.contractAddress = tokenContract;
        record.name = 'MockToken';
        record.symbol = 'MCK';
        record.decimals = 18;
        record.icon = null;
        record.source = AssetSource.Custom;
        record.priceInUSDT = null;
      });
    });

    provider = new StubChainProvider({ chainId: network.chainId, networkType: network.networkType });
    provider.setNativeBalance(addressValue, '0xde0b6b3a7640000'); // 1
    provider.setTokenBalance(tokenContract, '0x1bc16d674ec80000'); // 2

    registry.register(provider);

    service = container.get(AssetService);
  });

  afterEach(() => {
    container.unbindAll();
  });

  it('returns assets with normalized balances for an address', async () => {
    const assets = await service.getAssetsByAddress(address.id);

    expect(assets).toHaveLength(2);
    const native = assets.find((item) => item.type === AssetType.Native);
    const token = assets.find((item) => item.type === AssetType.ERC20);

    expect(native?.balance).toBe('1');
    expect(native?.formattedBalance).toBe('1');
    expect(native?.priceValue).toBe('1');

    expect(token?.balance).toBe('2');
    expect(token?.formattedBalance).toBe('2');
    expect(token?.priceValue).toBeNull();
  });

  it('gets balance for a specific asset', async () => {
    const balance = await service.getAssetBalance(address.id, tokenAsset.id);
    expect(balance).toBe('2');
  });

  it('adds custom token with metadata fetched from chain', async () => {
    const nameData = iface777.encodeFunctionData('name', []) as Hex;
    const symbolData = iface777.encodeFunctionData('symbol', []) as Hex;
    const decimalsData = iface777.encodeFunctionData('decimals', []) as Hex;

    const newTokenContract = 'cfxtest:achs3nehae0j6ksvy1bhrffsh1rtfrw1f6w1kzv46t';

    provider.setCallResponse(newTokenContract, nameData, iface777.encodeFunctionResult('name', ['MockToken']) as Hex);
    provider.setCallResponse(newTokenContract, symbolData, iface777.encodeFunctionResult('symbol', ['MCK']) as Hex);
    provider.setCallResponse(newTokenContract, decimalsData, iface777.encodeFunctionResult('decimals', [18]) as Hex);

    const result = await service.addCustomToken({
      addressId: address.id,
      contractAddress: newTokenContract,
    });

    expect(result.name).toBe('MockToken');
    expect(result.symbol).toBe('MCK');
    expect(result.decimals).toBe(18);
  });

  it('prevents adding duplicate custom token', async () => {
    await expect(
      service.addCustomToken({
        addressId: address.id,
        contractAddress: tokenContract,
      }),
    ).rejects.toThrow('Token already exists in this asset rule.');
  });
});
