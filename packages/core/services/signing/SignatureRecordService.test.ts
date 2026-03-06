import 'reflect-metadata';

import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxSource, TxStatus } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { mockDatabase } from '@core/testUtils/mocks';
import { StubChainProvider } from '@core/testUtils/mocks/chainProviders';
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
  let eventBus: InMemoryEventBus<CoreEventMap>;

  const getService = () => container.get(SignatureRecordService);

  const createTx = async (params: { addressId: string; method?: string; extraMethod?: string | null; data?: string | null }): Promise<Tx> => {
    const { addressId, method = 'transfer', extraMethod = 'transfer', data = '0x' } = params;
    const address = await database.get<Address>(TableName.Address).find(addressId);
    const addressValue = await address.getValue();

    const payload = database.get<TxPayload>(TableName.TxPayload).prepareCreate((record) => {
      record.type = '2';
      record.accessList = null;
      record.maxFeePerGas = null;
      record.maxPriorityFeePerGas = null;
      record.from = addressValue;
      record.to = '0x0000000000000000000000000000000000000001';
      record.gasPrice = null;
      record.gasLimit = '21000';
      record.storageLimit = null;
      record.data = data;
      record.value = '0x1';
      record.nonce = 1;
      record.chainId = '1';
      record.epochHeight = null;
    });

    const extra = database.get<TxExtra>(TableName.TxExtra).prepareCreate((record) => {
      record.ok = false;
      record.contractCreation = false;
      record.simple = true;
      record.sendAction = null;
      record.contractInteraction = false;
      record.token20 = false;
      record.tokenNft = false;
      record.address = payload.to;
      record.method = extraMethod;
    });

    const tx = database.get<Tx>(TableName.Tx).prepareCreate((record) => {
      record.raw = '0xraw';
      record.hash = '0xtx';
      record.status = TxStatus.PENDING;
      record.executedStatus = null;
      record.receipt = null;
      record.executedAt = null;
      record.errorType = null;
      record.err = null;
      record.sendAt = new Date();
      record.resendAt = null;
      record.resendCount = null;
      record.pollingCount = null;
      record.confirmedNumber = null;
      record.isTempReplacedByInner = null;
      record.source = TxSource.SELF;
      record.method = method;
      record.address.set(address);
      record.txExtra.set(extra);
      record.txPayload.set(payload);
    });

    await database.write(async () => {
      await database.batch(payload, extra, tx);
    });

    return tx;
  };

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    chainRegistry = new ChainRegistry();
    eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: true });

    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(CORE_IDENTIFIERS.EVENT_BUS).toConstantValue(eventBus);
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
    const changedEvents: CoreEventMap['signature/changed'][] = [];

    eventBus.on('signature/changed', (payload) => changedEvents.push(payload));

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
    expect(changedEvents).toEqual([
      {
        addressId: address.id,
        signatureId,
        reason: 'created',
      },
    ]);
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

  it('emits tx-linked event after linking a tx to a tx signature record', async () => {
    const { address, network } = await createTestAccount(database);
    const changedEvents: CoreEventMap['signature/changed'][] = [];

    eventBus.on('signature/changed', (payload) => changedEvents.push(payload));

    chainRegistry.register(
      new StubChainProvider({
        chainId: network.chainId,
        networkType: network.networkType,
        rpc: createRpc({ cfx_epochNumber: '0x30' }),
      }),
    );

    const signatureId = await getService().createRecord({
      addressId: address.id,
      signType: SignType.TX,
    });
    const tx = await createTx({ addressId: address.id });

    expect(changedEvents).toEqual([]);

    await getService().linkTx({ signatureId, txId: tx.id });

    expect(changedEvents).toEqual([
      {
        addressId: address.id,
        signatureId,
        reason: 'tx-linked',
        txId: tx.id,
      },
    ]);
  });
});
