import 'reflect-metadata';

import { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import { AssetSource, type Asset as DbAsset, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Signature } from '@core/database/models/Signature';
import { SignType } from '@core/database/models/Signature/type';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, ExecutedStatus, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CHAIN_PROVIDER_NOT_FOUND, TX_BROADCAST_FAILED, TX_INVALID_PARAMS } from '@core/errors';
import type { CoreEventMap, EventBus } from '@core/modules/eventBus';
import { InMemoryEventBus } from '@core/modules/eventBus';
import type { RuntimeConfig } from '@core/runtime/types';
import { AddressValidationService } from '@core/services/address/AddressValidationService';
import { SigningService } from '@core/services/signing';
import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { createSilentLogger, DEFAULT_PRIVATE_KEY, mockDatabase } from '@core/testUtils/mocks';
import { StubChainProvider } from '@core/testUtils/mocks/chainProviders';
import { AssetType, type IChainRpc, type ISigner, TxStatus as ServiceTxStatus } from '@core/types';
import { Container } from 'inversify';
import { ChainStatusService } from '../chain/ChainStatusService';
import { SignatureRecordService } from '../signing/SignatureRecordService';
import { TransactionService } from './TransactionService';
import type { ITransaction, SendERC20Input, SendTransactionInput } from './types';

async function createDbTx(params: {
  database: Database;
  address: Address;
  status: DbTxStatus;
  executedStatus?: ExecutedStatus | null;
  from: string;
  to: string;
  hash: string;
  sendAt: Date;
  nonce?: number;
  gasPrice?: string | null;
  maxFeePerGas?: string | null;
  maxPriorityFeePerGas?: string | null;
  sendAction?: 'SpeedUp' | 'Cancel' | null;
  source?: TxSource;
  method?: string;
}) {
  const {
    database,
    address,
    status,
    executedStatus = null,
    from,
    to,
    hash,
    sendAt,
    nonce = 1,
    gasPrice = '0x1',
    maxFeePerGas = null,
    maxPriorityFeePerGas = null,
    sendAction = null,
    source = TxSource.SELF,
    method = 'transfer',
  } = params;

  let tx: Tx;

  await database.write(async () => {
    const payload = await database.get<TxPayload>(TableName.TxPayload).create((record) => {
      record.from = from;
      record.to = to;
      record.value = '0x1';
      record.nonce = nonce;
      record.chainId = '0x1';
      record.gasPrice = gasPrice;
      record.maxFeePerGas = maxFeePerGas;
      record.maxPriorityFeePerGas = maxPriorityFeePerGas;
    });

    const extra = await database.get<TxExtra>(TableName.TxExtra).create((record) => {
      record.ok = true;
      record.simple = true;
      record.contractInteraction = false;
      record.token20 = false;
      record.tokenNft = false;
      record.sendAction = sendAction;
    });

    tx = await database.get<Tx>(TableName.Tx).create((record) => {
      record.address.set(address);
      record.txPayload.set(payload);
      record.txExtra.set(extra);
      record.hash = hash;
      record.raw = '0xraw';
      record.status = status;
      record.executedStatus = executedStatus;
      record.sendAt = sendAt;
      record.source = source;
      record.method = method;
    });
  });

  return tx!;
}
class FakeSigningService {
  getSigner = jest.fn(async (_accountId: string, _addressId: string): Promise<ISigner> => {
    return {
      type: 'software',
      getPrivateKey: () => DEFAULT_PRIVATE_KEY,
    };
  });
}

describe('TransactionService', () => {
  let container: Container;
  let database: Database;
  let chainRegistry: ChainRegistry;
  let signingService: FakeSigningService;
  let eventBus: EventBus<CoreEventMap>;
  let runtimeConfig: RuntimeConfig;
  let service: TransactionService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    chainRegistry = new ChainRegistry();
    signingService = new FakeSigningService();
    runtimeConfig = { wallet: { pendingCountLimit: 5 } };

    eventBus = new InMemoryEventBus<CoreEventMap>({ logger: createSilentLogger(), assertSerializable: true });
    container.bind(CORE_IDENTIFIERS.EVENT_BUS).toConstantValue(eventBus);
    container.bind(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(CORE_IDENTIFIERS.CONFIG).toConstantValue(runtimeConfig);
    container.bind(ChainRegistry).toConstantValue(chainRegistry);

    container.bind(ChainStatusService).toSelf();
    container.bind(AddressValidationService).toSelf();
    container.bind(SignatureRecordService).toSelf();

    container.bind(SigningService).toConstantValue(signingService as unknown as SigningService);
    container.bind(TransactionService).toSelf();

    service = container.get(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    container.unbindAll();
  });

  it('sends native transaction and creates Tx records', async () => {
    const createdEvents: CoreEventMap['tx/created'][] = [];
    eventBus.on('tx/created', (payload) => createdEvents.push(payload));
    const { account, address, network, assetRule } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = DbAssetType.Native;
        record.contractAddress = null;
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.priceInUSDT = null;
        record.source = AssetSource.Official;
      });
    });

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1.23',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    const result = await service.sendNative(input);

    expect(result.networkId).toBe(network.id);
    expect(result.status).toBe(ServiceTxStatus.Pending);
    expect(result.hash).toBe('0xhash');
    expect(result.from).toBe(await address.getValue());
    expect(result.to).toBe(input.to);

    const txs = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(txs).toHaveLength(1);
    const tx = txs[0];

    const signatures = await database.get<Signature>(TableName.Signature).query().fetch();
    expect(signatures).toHaveLength(1);
    expect(signatures[0].signType).toBe(SignType.TX);
    expect(signatures[0].tx.id).toBe(tx.id);
    expect(tx.hash).toBe('0xhash');
    expect(tx.status).toBe(DbTxStatus.PENDING);

    const txPayload = await tx.txPayload.fetch();
    expect(txPayload.from).toBe(await address.getValue());
    expect(txPayload.to).toBe(input.to);
    expect(txPayload.chainId).toBe(network.chainId);

    const txExtra = await tx.txExtra.fetch();
    expect(txExtra.simple).toBe(true);
    expect(txExtra.token20).toBe(false);
    expect(txExtra.contractInteraction).toBe(false);

    const asset = await tx.getAsset();
    expect(asset?.type).toBe(DbAssetType.Native);

    expect(signingService.getSigner).toHaveBeenCalledWith(account.id, address.id, expect.objectContaining({ signal: undefined }));

    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0]).toEqual({
      key: { addressId: address.id, networkId: network.id },
      txId: result.id,
    });
  });

  it('maps executedStatus=FAILED to failed even when db status is EXECUTED', async () => {
    const { address } = await createTestAccount(database);

    await createDbTx({
      database,
      address,
      status: DbTxStatus.EXECUTED,
      executedStatus: ExecutedStatus.FAILED,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash_failed',
      sendAt: new Date(),
      method: 'transfer',
    });

    const activity = await service.listActivityTransactions({ addressId: address.id, status: 'finished' });
    expect(activity).toHaveLength(1);
    expect(activity[0].status).toBe(ServiceTxStatus.Failed);
  });

  it('dedupes activity list by nonce (keeps latest pending tx for the same nonce)', async () => {
    const seeded = await seedNetwork(database, { definitionKey: 'Conflux eSpace' });
    const { address } = await createTestAccount(database, { network: seeded.network, assetRule: seeded.assetRule });

    await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash_origin',
      nonce: 7,
      sendAt: new Date(Date.now() - 10_000),
      method: 'transfer',
    });

    await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash_replacement',
      nonce: 7,
      sendAt: new Date(Date.now() - 1_000),
      method: 'transfer',
    });

    const list = await service.listActivityTransactions({ addressId: address.id, status: 'pending' });
    expect(list).toHaveLength(1);
    expect(list[0].hash).toBe('0xhash_replacement');
  });

  it('hides origin tx after speedUp broadcast succeeds (prevents duplicate pending & resends)', async () => {
    const seeded = await seedNetwork(database, { definitionKey: 'Conflux eSpace' });
    const { account, address, network } = await createTestAccount(database, { network: seeded.network, assetRule: seeded.assetRule });

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    const origin = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: await address.getValue(),
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash_origin_speedup',
      nonce: 1,
      gasPrice: '0x1',
      sendAt: new Date(),
      source: TxSource.SELF,
      method: 'transfer',
    });

    const result = await service.speedUpTx({
      txId: origin.id,
      action: 'SpeedUp',
      feeOverrides: { gasPrice: '0x2' },
      nonce: 1,
    });

    expect(result.status).toBe(ServiceTxStatus.Pending);
    expect(signingService.getSigner).toHaveBeenCalledWith(account.id, address.id, expect.anything());

    const originAfter = await database.get<Tx>(TableName.Tx).find(origin.id);
    expect(originAfter.isTempReplacedByInner).toBe(true);
    expect(originAfter.raw).toBeNull();
  });

  it('dispatches hardware signing start/success events when signer is hardware', async () => {
    const started: CoreEventMap['hardware-sign/started'][] = [];
    const succeeded: CoreEventMap['hardware-sign/succeeded'][] = [];
    eventBus.on('hardware-sign/started', (payload) => started.push(payload));
    eventBus.on('hardware-sign/succeeded', (payload) => succeeded.push(payload));

    const { account, address, network, assetRule } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = DbAssetType.Native;
        record.contractAddress = null;
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.priceInUSDT = null;
        record.source = AssetSource.Official;
      });
    });

    signingService.getSigner.mockResolvedValueOnce({
      type: 'hardware',
      getDerivationPath: () => "m/44'/60'/0'/0/0",
      getChainType: () => network.networkType,
      signWithHardware: jest.fn(async () => ({ resultType: 'signature', chainType: network.networkType, r: '0x1', s: '0x2', v: 27 })),
    } as any);

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1.23',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    await service.sendNative(input);

    expect(started).toHaveLength(1);
    expect(succeeded).toHaveLength(1);

    const startPayload = started[0];
    const successPayload = succeeded[0];

    expect(startPayload).toMatchObject({
      accountId: account.id,
      addressId: address.id,
      networkId: network.id,
    });
    expect(typeof startPayload.requestId).toBe('string');
    expect(successPayload.requestId).toBe(startPayload.requestId);

    expect(successPayload).toMatchObject({
      txHash: '0xhash',
      rawTransaction: '0xraw',
    });
  });

  it('dispatches hardware signing error event when hardware signing fails', async () => {
    const started: CoreEventMap['hardware-sign/started'][] = [];
    const failed: CoreEventMap['hardware-sign/failed'][] = [];
    eventBus.on('hardware-sign/started', (payload) => started.push(payload));
    eventBus.on('hardware-sign/failed', (payload) => failed.push(payload));

    const { account, address, network, assetRule } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = DbAssetType.Native;
        record.contractAddress = null;
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.priceInUSDT = null;
        record.source = AssetSource.Official;
      });
    });

    const signWithHardware = jest.fn(async () => {
      throw Object.assign(new Error('boom'), { code: 'HARDWARE_UNAVAILABLE', details: { reason: 'card_missing' } });
    });

    signingService.getSigner.mockResolvedValueOnce({
      type: 'hardware',
      getDerivationPath: () => "m/44'/60'/0'/0/0",
      getChainType: () => network.networkType,
      signWithHardware,
    } as any);

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1.23',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    await expect(service.sendNative(input)).rejects.toBeInstanceOf(Error);

    expect(started).toHaveLength(1);
    expect(failed).toHaveLength(1);

    const startPayload = started[0];
    const errorPayload = failed[0];

    expect(errorPayload.requestId).toBe(startPayload.requestId);
    expect(errorPayload.error).toMatchObject({ code: 'HARDWARE_UNAVAILABLE', reason: 'card_missing' });
  });

  it('estimates EVM native transfer gas and 1559 suggestions for UI', async () => {
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux eSpace' });
    const { address } = await createTestAccount(database, { network, assetRule });

    const request: IChainRpc['request'] = jest.fn(async <T = unknown>(method: string): Promise<T> => {
      if (method === 'eth_gasPrice') return '0x1' as unknown as T;
      if (method === 'eth_getBlockByNumber') return { baseFeePerGas: '0x1' } as unknown as T;
      if (method === 'eth_getCode') return '0x' as unknown as T;
      throw new Error(`unexpected method: ${method}`);
    });
    const batch: IChainRpc['batch'] = jest.fn(async <T = unknown>(): Promise<T[]> => []);

    chainRegistry.register(new StubChainProvider({ chainId: network.chainId, networkType: network.networkType, rpc: { request, batch } }));

    const estimate = await service.estimateLegacyGasForUi({
      addressId: address.id,
      withNonce: false,
      tx: {
        from: await address.getValue(),
        to: '0x0000000000000000000000000000000000000001',
        value: '0x0',
        data: '0x',
      },
    });

    expect(estimate.gasLimit).toBe('0x5208');
    expect(estimate.estimate).toBeUndefined();
    expect(estimate.estimateOf1559?.medium.gasCost).toMatch(/^0x/);
    expect(estimate.nonce).toBe(0);
  });

  it('estimates Conflux native transfer gas and legacy suggestions for UI', async () => {
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux Testnet' });
    const { address } = await createTestAccount(database, { network, assetRule });

    const request: IChainRpc['request'] = jest.fn(async <T = unknown>(method: string): Promise<T> => {
      if (method === 'cfx_gasPrice') return '0x1' as unknown as T;
      if (method === 'cfx_getBlockByEpochNumber') return {} as unknown as T;
      throw new Error(`unexpected method: ${method}`);
    });
    const batch: IChainRpc['batch'] = jest.fn(async <T = unknown>(): Promise<T[]> => []);

    chainRegistry.register(new StubChainProvider({ chainId: network.chainId, networkType: network.networkType, rpc: { request, batch } }));

    const estimate = await service.estimateLegacyGasForUi({
      addressId: address.id,
      withNonce: false,
      tx: {
        from: await address.getValue(),
        to: 'cfx:aaejuaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0sfbnjm2zz',
        value: '0x0',
        data: '0x',
      },
    });

    expect(estimate.gasLimit).toBe('0x5208');
    expect(estimate.storageLimit).toBe('0x0');
    expect(estimate.estimate?.medium.gasCost).toMatch(/^0x/);
    expect(estimate.estimateOf1559).toBeUndefined();
    expect(estimate.nonce).toBe(0);
  });

  it('dispatches hardware signing abort event when caller aborts via signal', async () => {
    const started: CoreEventMap['hardware-sign/started'][] = [];
    const aborted: CoreEventMap['hardware-sign/aborted'][] = [];
    eventBus.on('hardware-sign/started', (payload) => started.push(payload));
    eventBus.on('hardware-sign/aborted', (payload) => aborted.push(payload));

    const { account, address, network, assetRule } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = DbAssetType.Native;
        record.contractAddress = null;
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.priceInUSDT = null;
        record.source = AssetSource.Official;
      });
    });

    const controller = new AbortController();

    const signWithHardware = jest.fn(async (ctx: any) => {
      controller.abort();
      throw Object.assign(new Error('aborted'), { code: 'CANCEL' });
    });

    signingService.getSigner.mockResolvedValueOnce({
      type: 'hardware',
      getDerivationPath: () => "m/44'/60'/0'/0/0",
      getChainType: () => network.networkType,
      signWithHardware,
    } as any);

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1.23',
      assetType: AssetType.Native,
      assetDecimals: 18,
      signal: controller.signal,
    };

    await expect(service.sendNative(input)).rejects.toBeInstanceOf(Error);

    expect(started).toHaveLength(1);
    expect(aborted).toHaveLength(1);

    const startPayload = started[0];
    const abortPayload = aborted[0];
    expect(abortPayload.requestId).toBe(startPayload.requestId);
  });
  it('sends ERC20 transaction via sendERC20 and marks token20 in TxExtra', async () => {
    const { account, address, network } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    const contractAddress = '0x00000000000000000000000000000000000000ff';

    const input: SendERC20Input = {
      addressId: address.id,
      contractAddress,
      to: '0x0000000000000000000000000000000000000002',
      amount: '5.0',
      assetDecimals: 18,
    };

    const result = await service.sendERC20(input);

    expect(result.status).toBe(ServiceTxStatus.Pending);
    expect(result.hash).toBe('0xhash');

    const txs = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(txs).toHaveLength(1);
    const tx = txs[0];

    const txExtra = await tx.txExtra.fetch();
    expect(txExtra.token20).toBe(true);
    expect(txExtra.simple).toBe(false);
    expect(txExtra.method).toBe('transfer');

    const txPayload = await tx.txPayload.fetch();

    expect(txPayload.to).toBe(contractAddress);

    expect(signingService.getSigner).toHaveBeenCalledWith(account.id, address.id, expect.objectContaining({ signal: undefined }));
  });
  it('persists SEND_FAILED tx when broadcastTransaction throws', async () => {
    const { address, network, assetRule } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    await database.write(async () => {
      await database.get<DbAsset>(TableName.Asset).create((record) => {
        record.network.set(network);
        record.assetRule.set(assetRule);
        record.type = DbAssetType.Native;
        record.contractAddress = null;
        record.name = 'Native';
        record.symbol = 'NATIVE';
        record.decimals = 18;
        record.icon = null;
        record.priceInUSDT = null;
        record.source = AssetSource.Official;
      });
    });

    jest.spyOn(provider, 'broadcastTransaction').mockRejectedValue(new Error('network error'));

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    await expect(service.sendNative(input)).rejects.toThrow('network error');

    const txs = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(txs).toHaveLength(1);
    const tx = txs[0];
    const signatures = await database.get<Signature>(TableName.Signature).query().fetch();
    expect(signatures).toHaveLength(1);
    expect(signatures[0].signType).toBe(SignType.TX);
    expect(signatures[0].tx.id).toBe(tx.id);

    expect(tx.status).toBe(DbTxStatus.SEND_FAILED);
    expect(tx.err).toContain('network error');
  });

  it('maps database status to simplified service status via toInterface', async () => {
    const { address, network } = await createTestAccount(database);

    const provider = new StubChainProvider({
      chainId: network.chainId,
      networkType: network.networkType,
    });
    chainRegistry.register(provider);

    const input: SendTransactionInput = {
      addressId: address.id,
      to: '0x0000000000000000000000000000000000000001',
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    };

    await service.sendNative(input);
    const [tx] = await database.get<Tx>(TableName.Tx).query().fetch();

    const toInterface = (service as any).toInterface.bind(service) as (tx: Tx) => Promise<ITransaction>;

    const executedTx = await tx.updateSelf((record) => {
      record.status = DbTxStatus.EXECUTED;
    });
    const executedView = await toInterface(executedTx);
    expect(executedView.status).toBe(ServiceTxStatus.Confirmed);

    const failedTx = await tx.updateSelf((record) => {
      record.status = DbTxStatus.SEND_FAILED;
    });
    const failedView = await toInterface(failedTx);
    expect(failedView.status).toBe(ServiceTxStatus.Failed);

    const pendingTx = await tx.updateSelf((record) => {
      record.status = DbTxStatus.PENDING;
    });
    const pendingView = await toInterface(pendingTx);
    expect(pendingView.status).toBe(ServiceTxStatus.Pending);
  });

  it('listTransactions filters by status and respects limit', async () => {
    const { address } = await createTestAccount(database, { selected: true });
    await createDbTx({
      database,
      address,
      status: DbTxStatus.WAITTING,
      from: await address.getValue(),
      to: '0xreceiver1',
      hash: '0xhash_pending',
      sendAt: new Date('2025-11-01T00:00:00Z'),
    });
    await createDbTx({
      database,
      address,
      status: DbTxStatus.CONFIRMED,
      from: '0xsender',
      to: await address.getValue(),
      hash: '0xhash_finished',
      sendAt: new Date('2025-11-02T00:00:00Z'),
    });

    const pending = await service.listTransactions({ addressId: address.id, status: 'pending' });
    expect(pending).toHaveLength(1);
    expect(pending[0].hash).toBe('0xhash_pending');

    const finished = await service.listTransactions({ addressId: address.id, status: 'finished' });
    expect(finished).toHaveLength(1);
    expect(finished[0].hash).toBe('0xhash_finished');

    const limited = await service.listTransactions({ addressId: address.id, status: 'all', limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0].hash).toBe('0xhash_finished');
  });
  it('getTransactionById returns null when tx does not exist', async () => {
    const { address } = await createTestAccount(database, { selected: true });
    const tx = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: await address.getValue(),
      to: '0xreceiver',
      hash: '0xhash_found',
      sendAt: new Date(),
    });

    const found = await service.getTransactionById(tx.id);
    expect(found?.hash).toBe('0xhash_found');

    const missing = await service.getTransactionById('non-existent');
    expect(missing).toBeNull();
  });

  it('getRecentlyAddresses dedupes peers and marks local accounts', async () => {
    const owner = await createTestAccount(database, { selected: true });

    const peerBase32 = 'cfxtest:aajvcejvcejvcejvcejvcejvcejvcejvceph1kch74';
    const peerHex = '0x1111111111111111111111111111111111111111';
    const localPeer = await createTestAccount(database, {
      selected: false,
      base32: peerBase32,
      hex: peerHex,
    });

    const ownerAddress = owner.address;
    const localPeerValue = await localPeer.address.getValue();

    await createDbTx({
      database,
      address: ownerAddress,
      status: DbTxStatus.CONFIRMED,
      from: await ownerAddress.getValue(),
      to: '0xexternal',
      hash: '0xhash_out',
      sendAt: new Date('2025-11-01T00:00:00Z'),
    });

    await createDbTx({
      database,
      address: ownerAddress,
      status: DbTxStatus.CONFIRMED,
      from: localPeerValue,
      to: await ownerAddress.getValue(),
      hash: '0xhash_in',
      sendAt: new Date('2024-04-01T00:00:00Z'),
    });

    const peers = await service.getRecentlyAddresses(ownerAddress.id, 5);

    const inbound = peers.find((item) => item.direction === 'inbound');
    expect(inbound).toBeDefined();
    expect(inbound!.addressValue).toBe(localPeerValue);
    expect(inbound!.isLocalAccount).toBe(true);

    const outbound = peers.find((item) => item.direction === 'outbound');
    expect(outbound).toBeDefined();
    expect(outbound!.addressValue).toBe('0xexternal');
    expect(outbound!.isLocalAccount).toBe(false);

    expect(peers[0].lastUsedAt).toBeGreaterThanOrEqual(peers[1].lastUsedAt);
  });

  it('sends dapp transaction and marks source as dapp', async () => {
    const createdEvents: CoreEventMap['tx/created'][] = [];
    eventBus.on('tx/created', (payload) => createdEvents.push(payload));

    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'eSpace Testnet', selected: true });
    const { account, address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({
      chainId: evmNetwork.chainId,
      networkType: evmNetwork.networkType,
    });
    chainRegistry.register(provider);

    const request = {
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: '0x2',
      gas: '0x5208',
      gasPrice: '0x1',
      nonce: '0x1',
      type: '0x0',
    } as any;

    const result = await service.sendDappTransaction({ addressId: address.id, request });

    const txs = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(txs).toHaveLength(1);
    expect(txs[0].source).toBe(TxSource.DAPP);

    const signatures = await database.get<Signature>(TableName.Signature).query().fetch();
    expect(signatures).toHaveLength(1);
    expect(signatures[0].signType).toBe(SignType.TX);
    expect(signatures[0].tx.id).toBe(txs[0].id);

    const payload = await txs[0].txPayload.fetch();
    expect(payload.from).toBe(address.hex);
    expect(payload.to).toBe(request.to);
    expect(payload.value).toBe(request.value);
    expect(payload.gasLimit).toBe(request.gas);
    expect(payload.nonce).toBe(1);

    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0]).toEqual({
      key: { addressId: address.id, networkId: evmNetwork.id },
      txId: result.id,
    });
  });

  it('does not override dapp request fields when estimating', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'eSpace Testnet', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({
      chainId: evmNetwork.chainId,
      networkType: evmNetwork.networkType,
    });
    jest.spyOn(provider, 'estimateFee').mockResolvedValue({
      chainType: provider.networkType,
      estimatedTotal: '0x999',
      gasLimit: '0xffff',
      gasPrice: '0x777',
      maxFeePerGas: '0x888',
      maxPriorityFeePerGas: '0x999',
    });
    chainRegistry.register(provider);

    const request = {
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      data: '0xdeadbeef',
      value: '0x2',
      gas: '0x5208',
      gasPrice: '0x1',
      maxFeePerGas: '0x10',
      maxPriorityFeePerGas: '0x5',
      nonce: '0x7',
      type: '0x2',
    } as any;

    await service.sendDappTransaction({ addressId: address.id, request });

    const [tx] = await database.get<Tx>(TableName.Tx).query().fetch();
    const payload = await tx.txPayload.fetch();
    expect(payload).toMatchObject({
      data: request.data,
      value: request.value,
      gasLimit: request.gas,
      gasPrice: request.gasPrice,
      maxFeePerGas: request.maxFeePerGas,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas,
      nonce: 7,
      type: '2',
    });
  });

  it('throws TX_BROADCAST_FAILED and persists failed dapp tx', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'eSpace Testnet', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({
      chainId: evmNetwork.chainId,
      networkType: evmNetwork.networkType,
    });
    jest.spyOn(provider, 'broadcastTransaction').mockRejectedValue(new Error('boom'));
    chainRegistry.register(provider);

    const request = {
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: '0x2',
      gas: '0x5208',
      gasPrice: '0x1',
      nonce: '0x1',
      type: '0x0',
    } as any;

    await expect(service.sendDappTransaction({ addressId: address.id, request })).rejects.toMatchObject({ code: TX_BROADCAST_FAILED });

    const [tx] = await database.get<Tx>(TableName.Tx).query().fetch();
    expect(tx).toMatchObject({ source: TxSource.DAPP, status: DbTxStatus.SEND_FAILED, err: 'boom' });

    const signatures = await database.get<Signature>(TableName.Signature).query().fetch();
    expect(signatures).toHaveLength(1);
    expect(signatures[0].signType).toBe(SignType.TX);
    expect(signatures[0].tx.id).toBe(tx.id);
  });

  it('throws CHAIN_PROVIDER_NOT_FOUND when dapp provider missing', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'eSpace Testnet', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const request = {
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      data: '0x',
      value: '0x2',
      gas: '0x5208',
    } as any;

    await expect(service.sendDappTransaction({ addressId: address.id, request })).rejects.toMatchObject({ code: CHAIN_PROVIDER_NOT_FOUND });
  });

  it('speeds up a pending tx and creates replacement records', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({ chainId: evmNetwork.chainId, networkType: evmNetwork.networkType });
    chainRegistry.register(provider);

    const origin = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      hash: '0xorig',
      sendAt: new Date(),
      nonce: 0,
      gasPrice: '0x1',
    });

    const result = await service.speedUpTx({
      txId: origin.id,
      action: 'SpeedUp',
      feeOverrides: { gasPrice: '0x2' },
      nonce: 0,
    });

    const created = await database.get<Tx>(TableName.Tx).find(result.id);
    const payload = await created.txPayload.fetch();
    const extra = await created.txExtra.fetch();

    expect(payload.nonce).toBe(0);
    expect(extra.sendAction).toBe('SpeedUp');
  });

  it('cancels a pending tx by sending a self-tx with same nonce', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({ chainId: evmNetwork.chainId, networkType: evmNetwork.networkType });
    chainRegistry.register(provider);

    const origin = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      hash: '0xorig',
      sendAt: new Date(),
      nonce: 0,
      gasPrice: '0x1',
    });

    const result = await service.speedUpTx({
      txId: origin.id,
      action: 'Cancel',
      feeOverrides: { gasPrice: '0x2' },
      nonce: 0,
    });

    const created = await database.get<Tx>(TableName.Tx).find(result.id);
    const payload = await created.txPayload.fetch();
    const extra = await created.txExtra.fetch();

    expect(extra.sendAction).toBe('Cancel');
    expect(created.source).toBe(TxSource.SELF);
    expect(created.method).toBe('transfer');
    expect(payload.to).toBe(address.hex);
    expect(payload.value).toBe('0x0');
    expect(payload.data).toBe('0x');
  });

  it('forces replacement action to Cancel when origin is already a cancel tx', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({ chainId: evmNetwork.chainId, networkType: evmNetwork.networkType });
    chainRegistry.register(provider);

    const origin = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: address.hex,
      to: address.hex,
      hash: '0xorig',
      sendAt: new Date(),
      nonce: 0,
      gasPrice: '0x1',
      sendAction: 'Cancel',
    });

    const result = await service.speedUpTx({
      txId: origin.id,
      action: 'SpeedUp',
      feeOverrides: { gasPrice: '0x2' },
      nonce: 0,
    });

    const created = await database.get<Tx>(TableName.Tx).find(result.id);
    const extra = await created.txExtra.fetch();
    expect(extra.sendAction).toBe('Cancel');
  });

  it('rejects replacement if fee is not bumped', async () => {
    const { network: evmNetwork, assetRule } = await seedNetwork(database, { definitionKey: 'Conflux eSpace', selected: true });
    const { address } = await createTestAccount(database, { network: evmNetwork, assetRule });

    const provider = new StubChainProvider({ chainId: evmNetwork.chainId, networkType: evmNetwork.networkType });
    chainRegistry.register(provider);

    const origin = await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: address.hex,
      to: '0x0000000000000000000000000000000000000001',
      hash: '0xorig',
      sendAt: new Date(),
      nonce: 0,
      gasPrice: '0x2',
    });

    await expect(
      service.speedUpTx({
        txId: origin.id,
        action: 'SpeedUp',
        feeOverrides: { gasPrice: '0x2' },
        nonce: 0,
      }),
    ).rejects.toMatchObject({ code: TX_INVALID_PARAMS });
  });

  it('checks pending tx count limit from runtime config', async () => {
    const { address } = await createTestAccount(database);

    // 2 pending-count statuses (WAITTING + PENDING)
    await createDbTx({
      database,
      address,
      status: DbTxStatus.PENDING,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash1',
      sendAt: new Date(),
    });
    await createDbTx({
      database,
      address,
      status: DbTxStatus.WAITTING,
      from: '0x0000000000000000000000000000000000000001',
      to: '0x0000000000000000000000000000000000000002',
      hash: '0xhash2',
      sendAt: new Date(),
    });

    runtimeConfig.wallet = { pendingCountLimit: 2 };
    await expect(service.isPendingTxsFull({ addressId: address.id })).resolves.toBe(true);

    runtimeConfig.wallet = { pendingCountLimit: 3 };
    await expect(service.isPendingTxsFull({ addressId: address.id })).resolves.toBe(false);
  });
});
