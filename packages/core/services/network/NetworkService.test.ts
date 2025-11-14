import 'reflect-metadata';

import { seedNetwork } from '@core/__tests__/fixtures';
import type { Database } from '@core/database';
import { mockDatabase } from '@core/database/__tests__/mockDatabases';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';

import { NetworkService } from './NetworkService';
import type { INetwork } from './types';

describe('NetworkService', () => {
  let container: Container;
  let database: Database;
  let service: NetworkService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind(NetworkService).toSelf();

    service = container.get(NetworkService);
  });

  afterEach(() => {
    container.unbindAll();
  });

  it('returns all networks as plain objects', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    const result = await service.getAllNetworks();

    expect(result).toHaveLength(1);

    const item = result[0] as INetwork;

    expect(item.id).toBe(network.id);
    expect(item.name).toBe(network.name);
    expect(item.endpoint).toBe(network.endpoint);
    expect(item.netId).toBe(network.netId);
    expect(item.chainId).toBe(network.chainId);
    expect(item.networkType).toBe(network.networkType);
    expect(item.chainType).toBe(network.chainType);
    expect(item.selected).toBe(true);
  });

  it('returns the selected network when one exists', async () => {
    const first = await seedNetwork(database, { selected: false });
    const second = await seedNetwork(database, { selected: true });

    const result = await service.getCurrentNetwork();

    expect(result.id).toBe(second.network.id);
    expect(result.selected).toBe(true);

    const records = await database.get<Network>(TableName.Network).query().fetch();
    const firstRecord = records.find((n) => n.id === first.network.id);
    const secondRecord = records.find((n) => n.id === second.network.id);

    expect(firstRecord).toBeDefined();
    expect(secondRecord).toBeDefined();
    expect(firstRecord!.selected).toBe(false);
    expect(secondRecord!.selected).toBe(true);
  });

  it('auto selects a fallback network when none is selected', async () => {
    const { network } = await seedNetwork(database, { selected: false });

    const result = await service.getCurrentNetwork();

    expect(result.id).toBe(network.id);
    expect(result.selected).toBe(true);

    const record = await database.get<Network>(TableName.Network).find(network.id);
    expect(record.selected).toBe(true);
  });

  it('throws when no networks are configured', async () => {
    await expect(service.getCurrentNetwork()).rejects.toThrow('No networks configured.');
  });

  it('switches selection between networks', async () => {
    const first = await seedNetwork(database, { selected: true });
    const second = await seedNetwork(database, { selected: false });

    await service.switchNetwork(second.network.id);

    const records = await database.get<Network>(TableName.Network).query().fetch();
    const firstRecord = records.find((n) => n.id === first.network.id);
    const secondRecord = records.find((n) => n.id === second.network.id);

    expect(firstRecord).toBeDefined();
    expect(secondRecord).toBeDefined();
    expect(firstRecord!.selected).toBe(false);
    expect(secondRecord!.selected).toBe(true);
  });

  it('does nothing when switching to an already selected network', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    await service.switchNetwork(network.id);

    const records = await database.get<Network>(TableName.Network).query().fetch();
    const record = records.find((n) => n.id === network.id);

    expect(record).toBeDefined();
    expect(record!.selected).toBe(true);
  });

  it('throws when switching to a non-existent network', async () => {
    await seedNetwork(database, { selected: true });

    await expect(service.switchNetwork('missing-network-id')).rejects.toThrow('Network missing-network-id not found.');
  });

  it('updates the current endpoint of a network', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    const newEndpoint = 'https://example.com/rpc';
    await service.updateEndpoint(network.id, newEndpoint);

    const record = await database.get<Network>(TableName.Network).find(network.id);
    expect(record.endpoint).toBe(newEndpoint);
  });

  it('adds endpoint entries and prevents duplicates', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    const first = await service.addEndpoint(network.id, {
      endpoint: 'https://example.com/rpc-1',
      type: 'outer',
    });

    expect(first).toBe(true);

    const recordAfterFirst = await database.get<Network>(TableName.Network).find(network.id);
    expect(recordAfterFirst.endpointsList).toEqual([{ endpoint: 'https://example.com/rpc-1', type: 'outer' }]);

    const second = await service.addEndpoint(network.id, {
      endpoint: 'https://example.com/rpc-1',
      type: 'outer',
    });

    expect(second).toBe(false);

    const recordAfterSecond = await database.get<Network>(TableName.Network).find(network.id);
    expect(recordAfterSecond.endpointsList).toEqual([{ endpoint: 'https://example.com/rpc-1', type: 'outer' }]);
  });

  it('removes endpoint entries that are not the current endpoint', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    const removableEndpoint = 'https://example.com/removable';
    await service.addEndpoint(network.id, {
      endpoint: removableEndpoint,
      type: 'outer',
    });

    const removed = await service.removeEndpoint(network.id, removableEndpoint);
    expect(removed).toBe(true);

    const record = await database.get<Network>(TableName.Network).find(network.id);
    expect(record.endpointsList.some((item) => item.endpoint === removableEndpoint)).toBe(false);
  });

  it('returns false when removing an endpoint that does not exist', async () => {
    const { network } = await seedNetwork(database, { selected: true });

    const removed = await service.removeEndpoint(network.id, 'https://not-in-list.com');
    expect(removed).toBe(false);

    const record = await database.get<Network>(TableName.Network).find(network.id);
    expect(record.endpointsList).toEqual([]);
  });
});
