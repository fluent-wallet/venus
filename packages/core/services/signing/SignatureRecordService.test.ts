import 'reflect-metadata';

import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { mockDatabase } from '@core/testUtils/mocks';
import { StubChainProvider } from '@core/testUtils/mocks/chainProviders';
import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import type { IChainRpc } from '@core/types';
import { Container } from 'inversify';
import { ChainStatusService } from '../chain/ChainStatusService';
import { SignatureRecordService } from './SignatureRecordService';

const createRpc = (handlers: Partial<Record<string, unknown>>): IChainRpc => {
  return {
    request: async (method: string) => {
      if (method in handlers) return handlers[method];
      throw new Error(`Unexpected rpc method: ${method}`);
    },
    batch: async () => [],
  };
};

describe('SignatureRecordService', () => {
  let container: Container;
  let database: Database;
  let chainRegistry: ChainRegistry;

  const getService = () => container.get(SignatureRecordService);

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    chainRegistry = new ChainRegistry();

    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(ChainRegistry).toConstantValue(chainRegistry);
    container.bind(ChainStatusService).toSelf();
    container.bind(SignatureRecordService).toSelf();
  });

  afterEach(() => {
    container.unbindAll();
    jest.clearAllMocks();
  });

  it('writes message signature record with EVM blockNumber (0x...)', async () => {
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'Ethereum Sepolia', selected: true });
    const { address } = await createTestAccount(database, { network, assetRule });

    chainRegistry.register(
      new StubChainProvider({
        chainId: network.chainId,
        networkType: network.networkType,
        rpc: createRpc({ eth_blockNumber: '0x10' }),
      }),
    );

    const signatureId = await getService().createRecord({
      addressId: address.id,
      signType: SignType.STR,
      message: 'hello',
    });

    const record = await database.get<Signature>(TableName.Signature).find(signatureId);

    expect(record.signType).toBe(SignType.STR);
    expect(record.message).toBe('hello');
    expect(record.blockNumber).toBe('0x10');
    expect(record.address.id).toBe(address.id);
  });

  it('writes tx signature record with Conflux epochHeight (0x...)', async () => {
    const { address, network } = await createTestAccount(database);

    chainRegistry.register(
      new StubChainProvider({
        chainId: network.chainId,
        networkType: network.networkType,
        rpc: createRpc({ cfx_epochNumber: '0x20' }),
      }),
    );

    const signatureId = await getService().createRecord({
      addressId: address.id,
      signType: SignType.TX,
    });

    const record = await database.get<Signature>(TableName.Signature).find(signatureId);

    expect(record.signType).toBe(SignType.TX);
    expect(record.message).toBeNull();
    expect(record.blockNumber).toBe('0x20');
  });

  it('falls back to 0x0 when chain provider is missing', async () => {
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'Ethereum Sepolia', selected: true });
    const { address } = await createTestAccount(database, { network, assetRule });

    const signatureId = await getService().createRecord({
      addressId: address.id,
      signType: SignType.JSON,
      message: '{"foo":"bar"}',
    });

    const record = await database.get<Signature>(TableName.Signature).find(signatureId);

    expect(record.blockNumber).toBe('0x0');
  });
});
