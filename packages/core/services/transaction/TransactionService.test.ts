import 'reflect-metadata';

import { createTestAccount } from '@core/__tests__/fixtures';
import { DEFAULT_PRIVATE_KEY, mockDatabase } from '@core/__tests__/mocks';
import { StubChainProvider } from '@core/__tests__/mocks/chainProviders';
import { ChainRegistry } from '@core/chains';

import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import { AssetSource, type Asset as DbAsset, AssetType as DbAssetType } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus as DbTxStatus, TxSource } from '@core/database/models/Tx/type';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import TableName from '@core/database/TableName';
import { SigningService } from '@core/services/signing';
import { AssetType, type ISigner, TxStatus as ServiceTxStatus } from '@core/types';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';
import { TransactionService } from './TransactionService';
import type { ITransaction, SendERC20Input, SendTransactionInput } from './types';

async function createDbTx(params: { database: Database; address: Address; status: DbTxStatus; from: string; to: string; hash: string; sendAt: Date }) {
  const { database, address, status, from, to, hash, sendAt } = params;

  let tx: Tx;

  await database.write(async () => {
    const payload = await database.get<TxPayload>(TableName.TxPayload).create((record) => {
      record.from = from;
      record.to = to;
      record.value = '0x1';
      record.nonce = 1;
      record.chainId = '0x1';
    });

    const extra = await database.get<TxExtra>(TableName.TxExtra).create((record) => {
      record.ok = true;
      record.simple = true;
      record.contractInteraction = false;
      record.token20 = false;
      record.tokenNft = false;
    });

    tx = await database.get<Tx>(TableName.Tx).create((record) => {
      record.address.set(address);
      record.txPayload.set(payload);
      record.txExtra.set(extra);
      record.hash = hash;
      record.raw = '0xraw';
      record.status = status;
      record.sendAt = sendAt;
      record.source = TxSource.SELF;
      record.method = 'transfer';
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
  let service: TransactionService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    chainRegistry = new ChainRegistry();
    signingService = new FakeSigningService();

    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind(ChainRegistry).toConstantValue(chainRegistry);
    container.bind(SigningService).toConstantValue(signingService as unknown as SigningService);
    container.bind(TransactionService).toSelf();

    service = container.get(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    container.unbindAll();
  });

  it('sends native transaction and creates Tx records', async () => {
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

    expect(signingService.getSigner).toHaveBeenCalledWith(account.id, address.id);
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

    expect(signingService.getSigner).toHaveBeenCalledWith(account.id, address.id);
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
});
