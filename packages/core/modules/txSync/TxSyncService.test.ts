import 'reflect-metadata';

import type { Database } from '@core/database';
import type { Tx } from '@core/database/models/Tx';
import { TxStatus } from '@core/database/models/Tx/type';
import type { TxPayload } from '@core/database/models/TxPayload';
import type { TxExtra } from '@core/database/models/TxExtra';
import TableName from '@core/database/TableName';
import { InMemoryEventBus, type CoreEventMap } from '@core/modules/eventBus';
import { createTestAccount } from '@core/testUtils/fixtures';
import { mockDatabase } from '@core/testUtils/mocks';
import type { IChainProvider } from '@core/types';
import { TxSyncService } from './TxSyncService';

describe('TxSyncService', () => {
  let database: Database;

  beforeEach(() => {
    database = mockDatabase();
  });

  it('emits tx/updated after database changes are committed', async () => {
    const { address, network } = await createTestAccount(database);
    const eventBus = new InMemoryEventBus<CoreEventMap>({ assertSerializable: true });
    const nowMs = 1_700_000_000_000;
    const executedAt = new Date(nowMs);
    const addressValue = await address.getValue();

    let tx!: Tx;
    await database.write(async () => {
      const payload = await database.get<TxPayload>(TableName.TxPayload).create((record) => {
        record.from = addressValue;
        record.to = '0x0000000000000000000000000000000000000001';
        record.value = '0x1';
        record.data = '0x';
        record.nonce = 1;
        record.chainId = network.chainId;
      });

      const extra = await database.get<TxExtra>(TableName.TxExtra).create((record) => {
        record.ok = true;
        record.simple = true;
        record.contractInteraction = false;
        record.token20 = false;
        record.tokenNft = false;
        record.sendAction = null;
        record.method = 'transfer';
      });

      tx = await database.get<Tx>(TableName.Tx).create((record) => {
        record.address.set(address);
        record.txPayload.set(payload);
        record.txExtra.set(extra);
        record.hash = '0xtx_sync_service';
        record.raw = '0xraw';
        record.status = TxStatus.PENDING;
        record.executedStatus = null;
        record.sendAt = new Date(nowMs - 1_000);
        record.source = 'SELF' as any;
        record.method = 'transfer';
      });
    });

    const engine = {
      run: jest.fn(async () => ({
        patches: [
          {
            txId: tx.id,
            set: {
              status: TxStatus.EXECUTED,
              executedAt,
            },
          },
        ],
      })),
    } as any;

    const service = new TxSyncService({
      db: database,
      engine,
      now: () => nowMs,
      eventBus,
    });

    const readsAfterEmit: Array<Promise<void>> = [];
    eventBus.on('tx/updated', (payload) => {
      readsAfterEmit.push(
        (async () => {
          expect(payload.txIds).toEqual([tx.id]);
          const updated = await database.get<Tx>(TableName.Tx).find(tx.id);
          expect(updated.status).toBe(TxStatus.EXECUTED);
          expect(updated.executedAt?.getTime()).toBe(nowMs);
        })(),
      );
    });

    await service.refreshKey({
      addressId: address.id,
      networkId: network.id,
      provider: {} as IChainProvider,
    });

    expect(engine.run).toHaveBeenCalledTimes(1);
    await Promise.all(readsAfterEmit);
    expect(readsAfterEmit).toHaveLength(1);
  });
});
