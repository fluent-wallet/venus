import 'reflect-metadata';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import { type Asset, AssetSource, AssetType } from '@core/database/models/Asset';
import TableName from '@core/database/TableName';
import { mockDatabase } from '@core/database/testUtils/mockDatabases';
import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeConfig } from '@core/runtime/types';
import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { Container } from 'inversify';
import { buildScanOpenApiKey } from './confluxScan';
import { NftService } from './NftService';

const originalFetch = globalThis.fetch;
const CONTRACT_A = '0x0000000000000000000000000000000000000001';
const CONTRACT_B = '0x0000000000000000000000000000000000000002';
const scanResponse = (list: unknown[], page: { total?: number; next?: string | number } = {}) =>
  ({ ok: true, json: async () => ({ status: '1', result: { total: list.length, ...page, list } }) }) as Response;

describe('NftService', () => {
  let database: Database;
  let service: NftService;
  let address: Address;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let config: RuntimeConfig;

  beforeEach(async () => {
    database = mockDatabase();
    const container = new Container();
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'eSpace Testnet', selected: true });
    ({ address } = await createTestAccount(database, { network, assetRule }));
    config = { nft: { scanOpenApiByKey: { [buildScanOpenApiKey(network)]: 'https://test-scan.example' } } };
    container.bind(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(CORE_IDENTIFIERS.CONFIG).toConstantValue(config);
    container.bind(NftService).toSelf();
    service = container.get(NftService);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const seedCollection = async (contractAddress: string) =>
    database.write(() =>
      database.get<Asset>(TableName.Asset).create((record) => {
        record.assetRule.id = address.assetRule.id;
        record.network.id = address.network.id;
        record.type = AssetType.ERC721;
        record.contractAddress = contractAddress;
        record.name = 'Existing NFT';
        record.symbol = 'NFT';
        record.decimals = 0;
        record.icon = null;
        record.source = AssetSource.Official;
        record.priceInUSDT = null;
      }),
    );

  it('uses Scan metadata and shares collection records without exposing other holdings', async () => {
    await seedCollection(CONTRACT_B);
    const other = await createTestAccount(database, {
      network: await address.network.fetch(),
      assetRule: await address.assetRule.fetch(),
      hex: '0x0000000000000000000000000000000000000003',
      selected: false,
    });
    const remote = { contract: CONTRACT_A, type: 'ERC721', name: 'Scan NFT', symbol: 'SNFT', iconUrl: 'scan-icon' };
    fetchMock.mockImplementation(async (input) => {
      const params = new URL(String(input)).searchParams;
      if (params.get('tokenType') !== 'ERC721') return scanResponse([]);
      return scanResponse(params.get('account') === other.address.hex ? [remote, { contract: CONTRACT_B, type: 'ERC721' }] : [remote]);
    });

    const [collections, otherCollections] = await Promise.all([
      service.listCollections({ addressId: address.id }),
      service.listCollections({ addressId: other.address.id }),
    ]);
    expect(collections.map((collection) => collection.contractAddress)).toEqual([CONTRACT_A]);
    expect(otherCollections.map((collection) => collection.contractAddress).sort()).toEqual([CONTRACT_A, CONTRACT_B]);
    expect(otherCollections.find((collection) => collection.contractAddress === CONTRACT_A)?.id).toBe(collections[0].id);
    expect(collections[0]).toMatchObject({ name: 'Scan NFT', symbol: 'SNFT', icon: 'scan-icon' });

    remote.name = 'Updated NFT';
    remote.symbol = 'NEW';
    remote.iconUrl = 'updated-icon';
    await expect(service.listCollections({ addressId: address.id })).resolves.toEqual([
      { ...collections[0], name: 'Updated NFT', symbol: 'NEW', icon: 'updated-icon' },
    ]);
    expect(await database.get<Asset>(TableName.Asset).query().fetchCount()).toBe(2);
  });

  it('keeps failures distinct from an empty owner response instead of returning the shared catalog', async () => {
    await seedCollection(CONTRACT_B);
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(service.listCollections({ addressId: address.id })).rejects.toThrow('offline');

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: '0', message: 'Scan unavailable' }) } as Response);
    await expect(service.listCollections({ addressId: address.id })).rejects.toThrow('Scan unavailable');

    fetchMock.mockResolvedValue(scanResponse([]));
    await expect(service.listCollections({ addressId: address.id })).resolves.toEqual([]);
  });

  it('uses the requested address and its network for item requests', async () => {
    const mainnet = await seedNetwork(database, { definitionKey: 'Conflux eSpace' });
    const other = await createTestAccount(database, { ...mainnet, hex: '0x0000000000000000000000000000000000000003', selected: false });
    config.nft = { scanOpenApiByKey: { ...config.nft?.scanOpenApiByKey, [buildScanOpenApiKey(mainnet.network)]: 'https://main-scan.example' } };
    fetchMock.mockResolvedValue(scanResponse([{ tokenId: '1', name: 'NFT #1', amount: '2', image: 'nft-image' }]));

    await service.getItemsPage({ cursor: '0', addressId: address.id, contractAddress: CONTRACT_A });
    const items = await service.getItemsPage({ cursor: '0', addressId: other.address.id, contractAddress: CONTRACT_A });
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls.map((url) => [url.origin, url.searchParams.get('owner')])).toEqual([
      ['https://test-scan.example', address.hex],
      ['https://main-scan.example', other.address.hex],
    ]);
    expect(items.items).toEqual([{ tokenId: '1', name: 'NFT #1', amount: '2', icon: 'nft-image', description: null }]);
  });

  it('loads the collection directory past 100 contracts and stops at the returned total', async () => {
    const contracts = Array.from({ length: 200 }, (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`);
    fetchMock.mockImplementation(async (input) => {
      const params = new URL(String(input)).searchParams;
      const skip = Number(params.get('skip'));
      return params.get('tokenType') === 'ERC721'
        ? scanResponse(
            contracts.slice(skip, skip + 100).map((contract) => ({ contract, type: 'ERC721' })),
            { total: contracts.length },
          )
        : scanResponse([]);
    });

    const collections = await service.listCollections({ addressId: address.id });
    expect(collections.map((collection) => collection.contractAddress.toLowerCase()).sort()).toEqual(contracts);
    const requests = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams);
    expect(requests.filter((params) => params.get('tokenType') === 'ERC721').map((params) => params.get('skip'))).toEqual(['0', '100']);
    expect(requests.every((params) => params.get('limit') === '100')).toBe(true);
  });

  it('preserves mixed Scan cursors and accepts the numeric end marker', async () => {
    const fullPage = [
      { tokenId: '0', amount: '1', error: 'invalid metadata uri: empty value' },
      ...Array.from({ length: 99 }, (_, index) => ({ tokenId: String(index + 1), amount: '1' })),
    ];
    fetchMock
      .mockResolvedValueOnce(scanResponse(fullPage, { total: 201, next: '22590843500000000' }))
      .mockResolvedValueOnce(scanResponse(fullPage, { total: 201, next: 1725261068000001 }))
      .mockResolvedValueOnce(scanResponse([], { next: 0 }));
    const params = { addressId: address.id, contractAddress: CONTRACT_A };

    await expect(service.getItemsPage({ ...params, cursor: '0' })).resolves.toMatchObject({ nextCursor: '22590843500000000' });
    await expect(service.getItemsPage({ ...params, cursor: '22590843500000000' })).resolves.toMatchObject({
      items: expect.arrayContaining([{ tokenId: '0', amount: '1', name: '', description: null, icon: null }]),
      nextCursor: '1725261068000001',
    });
    await expect(service.getItemsPage({ ...params, cursor: '1725261068000001' })).resolves.toEqual({ items: [], nextCursor: null });
    const requests = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams);
    expect(requests.map((query) => query.get('cursor'))).toEqual(['0', '22590843500000000', '1725261068000001']);
    expect(requests.every((query) => query.get('limit') === '100')).toBe(true);
  });

  it('ends short pages and a full first page that already contains the total, even when Scan returns a cursor', async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => ({ tokenId: String(index), amount: '1' }));
    const finalItems = [{ tokenId: 'last', amount: '1' }];
    fetchMock
      .mockResolvedValueOnce(scanResponse(finalItems, { total: 1, next: '123' }))
      .mockResolvedValueOnce(scanResponse(finalItems, { total: 101, next: 456 }))
      .mockResolvedValueOnce(scanResponse(fullPage, { next: '789' }));
    const params = { addressId: address.id, contractAddress: CONTRACT_A };

    for (const cursor of ['0', '123', '0']) {
      await expect(service.getItemsPage({ ...params, cursor })).resolves.toMatchObject({ nextCursor: null });
    }
  });
});
