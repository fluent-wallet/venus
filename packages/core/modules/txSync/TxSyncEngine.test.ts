import 'reflect-metadata';
import { TxStatus } from '@core/database/models/Tx/type';
import { NetworkType } from '@core/utils/consts';
import { ProcessErrorType } from '@core/utils/eth';
import { TxSyncEngine } from './TxSyncEngine';

const hex = (n: number | bigint): string => `0x${BigInt(n).toString(16)}`;

type RpcBatchItem = { method: string; params?: any[] };

type RpcStub = {
  request: jest.Mock<Promise<any>, [string, any[]?]>;
  batch: jest.Mock<Promise<any[]>, [RpcBatchItem[]]>;
};

const applyPatches = (txs: any[], patches: Array<{ txId: string; set: Record<string, any> }>) => {
  const byId = new Map(txs.map((t) => [t.txId, { ...t }]));
  for (const p of patches) {
    const t = byId.get(p.txId);
    if (!t) continue;
    byId.set(p.txId, { ...t, ...p.set });
  }
  return Array.from(byId.values());
};

const createEvmProvider = (state: {
  counts: { pending: number; latest: number; finalized: number };
  presenceByHash: Record<string, any | null>;
  receiptByHash: Record<string, any | null>;
  blockByHash: Record<string, any | null>;
  safeNumber: () => number;
  finalizedNumber: () => number;
}): { networkType: NetworkType; rpc: RpcStub } => {
  const request = jest.fn(async (method: string, params?: any[]) => {
    if (method === 'eth_getTransactionCount') {
      const tag = params?.[1];
      if (tag === 'pending') return hex(state.counts.pending);
      if (tag === 'latest') return hex(state.counts.latest);
      if (tag === 'finalized') return hex(state.counts.finalized);
      throw new Error(`unexpected txCount tag: ${String(tag)}`);
    }

    if (method === 'eth_sendRawTransaction') return '0xsent';

    throw new Error(`unexpected request method: ${method}`);
  });

  const batch = jest.fn(async (reqs: RpcBatchItem[]) => {
    return reqs.map((r) => {
      if (r.method === 'eth_getTransactionByHash') return state.presenceByHash[r.params?.[0]] ?? null;
      if (r.method === 'eth_getTransactionReceipt') return state.receiptByHash[r.params?.[0]] ?? null;

      if (r.method === 'eth_getTransactionCount') {
        const tag = r.params?.[1];
        if (tag === 'pending') return hex(state.counts.pending);
        if (tag === 'latest') return hex(state.counts.latest);
        if (tag === 'finalized') return hex(state.counts.finalized);
        throw new Error(`unexpected txCount tag in batch: ${String(tag)}`);
      }

      if (r.method === 'eth_getBlockByNumber') {
        const tag = r.params?.[0];
        if (tag === 'safe') return { number: hex(state.safeNumber()) };
        if (tag === 'finalized') return { number: hex(state.finalizedNumber()) };
        return null;
      }

      if (r.method === 'eth_getBlockByHash') {
        const h = r.params?.[0];
        return h ? (state.blockByHash[h] ?? null) : null;
      }

      throw new Error(`unexpected batch method: ${r.method}`);
    });
  });

  return { networkType: NetworkType.Ethereum, rpc: { request, batch } };
};

const createCfxProvider = (state: {
  counts: { pending: number; latestState: number; latestFinalized: number };
  presenceByHash: Record<string, any | null>;
  receiptByHash: Record<string, any | null>;
  blockByHash: Record<string, any | null>;
  latestConfirmed: () => number;
  latestFinalized: () => number;
}): { networkType: NetworkType; rpc: RpcStub } => {
  const request = jest.fn(async (method: string, params?: any[]) => {
    if (method === 'cfx_getNextNonce') {
      const tag = params?.[1];
      if (tag === undefined) return hex(state.counts.pending);
      if (tag === 'latest_state') return hex(state.counts.latestState);
      if (tag === 'latest_finalized') return hex(state.counts.latestFinalized);
      throw new Error(`unexpected cfx nonce tag: ${String(tag)}`);
    }

    if (method === 'cfx_getStatus') {
      return { latestConfirmed: hex(state.latestConfirmed()), latestFinalized: hex(state.latestFinalized()) };
    }

    if (method === 'cfx_sendRawTransaction') return '0xsent';

    throw new Error(`unexpected request method: ${method}`);
  });

  const batch = jest.fn(async (reqs: RpcBatchItem[]) => {
    return reqs.map((r) => {
      if (r.method === 'cfx_getTransactionByHash') return state.presenceByHash[r.params?.[0]] ?? null;
      if (r.method === 'cfx_getTransactionReceipt') return state.receiptByHash[r.params?.[0]] ?? null;
      if (r.method === 'cfx_getBlockByHash') {
        const h = r.params?.[0];
        return h ? (state.blockByHash[h] ?? null) : null;
      }
      if (r.method === 'cfx_getNextNonce') {
        const tag = r.params?.[1];
        if (tag === 'latest_state') return hex(state.counts.latestState);
        if (tag === 'latest_finalized') return hex(state.counts.latestFinalized);
        if (tag === undefined) return hex(state.counts.pending);
        throw new Error(`unexpected cfx nonce tag in batch: ${String(tag)}`);
      }
      throw new Error(`unexpected batch method: ${r.method}`);
    });
  });

  return { networkType: NetworkType.Conflux, rpc: { request, batch } };
};

describe('TxSyncEngine', () => {
  const now = () => 1_700_000_000_000;

  it('EVM: PENDING -> EXECUTED -> CONFIRMED -> FINALIZED (waterline)', async () => {
    const engine = new TxSyncEngine();

    const state = {
      counts: { pending: 1, latest: 1, finalized: 1 },
      presenceByHash: { '0xaaa': {} },
      receiptByHash: {
        '0xaaa': { status: '0x1', blockNumber: hex(16), blockHash: '0xb1', transactionIndex: '0x0', type: '0x0', gasUsed: '0x1' },
      },
      blockByHash: { '0xb1': { timestamp: hex(5) } },
      safe: 15,
      finalized: 14,
      safeNumber: function () {
        return this.safe;
      },
      finalizedNumber: function () {
        return this.finalized;
      },
    };

    const provider = createEvmProvider({
      counts: state.counts,
      presenceByHash: state.presenceByHash,
      receiptByHash: state.receiptByHash,
      blockByHash: state.blockByHash,
      safeNumber: () => state.safe,
      finalizedNumber: () => state.finalized,
    });

    let txs = [
      {
        txId: 't1',
        status: TxStatus.PENDING,
        nonce: 1,
        hash: '0xaaa',
        raw: '0xraw',
        resendCount: 0,
        createdAtMs: now(),
      },
    ];

    // EXECUTED (block 16 > safe 15)
    const r1 = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r1.patches);
    expect(txs[0].status).toBe(TxStatus.EXECUTED);

    // CONFIRMED (safe >= 16)
    state.safe = 16;
    state.finalized = 15;
    const r2 = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r2.patches);
    expect(txs[0].status).toBe(TxStatus.CONFIRMED);

    // FINALIZED (finalized >= 16)
    state.finalized = 16;
    const r3 = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r3.patches);
    expect(txs[0].status).toBe(TxStatus.FINALIZED);
  });

  it('CFX: PENDING -> CONFIRMED -> FINALIZED (latestConfirmed/latestFinalized)', async () => {
    const engine = new TxSyncEngine();

    const state = {
      counts: { pending: 1, latestState: 1, latestFinalized: 1 },
      presenceByHash: { '0xcfx1': { status: '0x0' } },
      receiptByHash: {
        '0xcfx1': {
          outcomeStatus: '0x0',
          epochNumber: hex(16),
          blockHash: '0xcb1',
          index: '0x0',
          type: '0x0',
          gasUsed: '0x1',
        },
      },
      blockByHash: { '0xcb1': { timestamp: hex(5) } },
      confirmed: 15,
      finalized: 14,
      latestConfirmed: function () {
        return this.confirmed;
      },
      latestFinalized: function () {
        return this.finalized;
      },
    };

    const provider = createCfxProvider({
      counts: state.counts,
      presenceByHash: state.presenceByHash,
      receiptByHash: state.receiptByHash,
      blockByHash: state.blockByHash,
      latestConfirmed: () => state.confirmed,
      latestFinalized: () => state.finalized,
    });

    let txs = [{ txId: 't1', status: TxStatus.PENDING, nonce: 1, hash: '0xcfx1', raw: '0xraw', resendCount: 0, createdAtMs: now() }];

    // EXECUTED (epoch 16 > confirmed 15)
    const r1 = await engine.run({ txs, provider: provider as any, addressValue: 'cfx:addr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r1.patches);
    expect(txs[0].status).toBe(TxStatus.EXECUTED);

    // CONFIRMED (confirmed >= 16)
    state.confirmed = 16;
    state.finalized = 15;
    const r2 = await engine.run({ txs, provider: provider as any, addressValue: 'cfx:addr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r2.patches);
    expect(txs[0].status).toBe(TxStatus.CONFIRMED);

    // FINALIZED (finalized >= 16)
    state.finalized = 16;
    const r3 = await engine.run({ txs, provider: provider as any, addressValue: 'cfx:addr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r3.patches);
    expect(txs[0].status).toBe(TxStatus.FINALIZED);
  });

  it('EVM: missing tx -> DISCARDED and resend increments (Infinity cap)', async () => {
    const engine = new TxSyncEngine();

    const provider = createEvmProvider({
      counts: { pending: 1, latest: 1, finalized: 1 }, // not used
      presenceByHash: { '0xmissing': null },
      receiptByHash: {},
      blockByHash: {},
      safeNumber: () => 0,
      finalizedNumber: () => 0,
    });

    const txs = [{ txId: 't1', status: TxStatus.PENDING, nonce: 1, hash: '0xmissing', raw: '0xraw', resendCount: 0, createdAtMs: now() }];

    const r = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });

    const patch = r.patches.find((p) => p.txId === 't1')?.set ?? {};
    expect(patch.status).toBe(TxStatus.PENDING);
    expect(patch.resendCount).toBe(1);
    expect(provider.rpc.request).toHaveBeenCalledWith('eth_sendRawTransaction', ['0xraw']);
  });

  it('EVM: receipt missing + nonceUsed temp -> TEMP_REPLACED; finalized -> REPLACED', async () => {
    const engine = new TxSyncEngine();

    const state = {
      counts: { pending: 1, latest: 2, finalized: 1 }, // temp_used for nonce=1
      presenceByHash: { '0xaaa': {} },
      receiptByHash: { '0xaaa': null },
      blockByHash: {},
      safe: 0,
      finalized: 0,
      safeNumber: function () {
        return this.safe;
      },
      finalizedNumber: function () {
        return this.finalized;
      },
    };

    const provider = createEvmProvider({
      counts: state.counts,
      presenceByHash: state.presenceByHash,
      receiptByHash: state.receiptByHash,
      blockByHash: state.blockByHash,
      safeNumber: () => state.safe,
      finalizedNumber: () => state.finalized,
    });

    let txs = [{ txId: 't1', status: TxStatus.PENDING, nonce: 1, hash: '0xaaa', raw: '0xraw', resendCount: 0, createdAtMs: now() }];

    const r1 = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });
    txs = applyPatches(txs, r1.patches);
    expect(txs[0].status).toBe(TxStatus.TEMP_REPLACED);

    // finalized_used for nonce=1
    state.counts.latest = 2;
    state.counts.finalized = 2;

    const r2 = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });
    const patch2 = r2.patches.find((p) => p.txId === 't1')?.set ?? {};
    expect(patch2.status).toBe(TxStatus.REPLACED);
    expect(patch2.raw).toBeNull();
    expect(patch2.errorType).toBe(ProcessErrorType.replacedByAnotherTx);
  });

  it('duplicate nonce: winner FINALIZED -> other tx marked REPLACED', async () => {
    const engine = new TxSyncEngine();

    const provider = createEvmProvider({
      counts: { pending: 1, latest: 1, finalized: 1 },
      presenceByHash: { '0xw': {}, '0xd': {} },
      receiptByHash: {
        '0xw': { status: '0x1', blockNumber: hex(16), blockHash: '0xb1', transactionIndex: '0x0', type: '0x0', gasUsed: '0x1' },
        '0xd': null,
      },
      blockByHash: { '0xb1': { timestamp: hex(5) } },
      safeNumber: () => 16,
      finalizedNumber: () => 16, // winner finalized
    });

    const txs = [
      { txId: 'winner', status: TxStatus.PENDING, nonce: 7, hash: '0xw', raw: '0xraw1', resendCount: 0, createdAtMs: now() },
      { txId: 'dup', status: TxStatus.PENDING, nonce: 7, hash: '0xd', raw: '0xraw2', resendCount: 0, createdAtMs: now() - 1 },
    ];

    const r = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });

    const dupPatch = r.patches.find((p) => p.txId === 'dup')?.set ?? {};
    expect(dupPatch.status).toBe(TxStatus.REPLACED);
    expect(dupPatch.raw).toBeNull();
    expect(dupPatch.isTempReplacedByInner).toBe(true);
    expect(dupPatch.errorType).toBe(ProcessErrorType.replacedByAnotherTx);
  });

  it('duplicate nonce: only resend one tx per nonce group (pick latest createdAt)', async () => {
    const engine = new TxSyncEngine();

    const provider = createEvmProvider({
      counts: { pending: 1, latest: 1, finalized: 1 }, // not used (not_used for nonce=1)
      presenceByHash: { '0xmissing1': null, '0xmissing2': null },
      receiptByHash: {},
      blockByHash: {},
      safeNumber: () => 0,
      finalizedNumber: () => 0,
    });

    const txs = [
      { txId: 'old', status: TxStatus.PENDING, nonce: 1, hash: '0xmissing1', raw: '0xraw_old', resendCount: 0, createdAtMs: 1000 },
      { txId: 'new', status: TxStatus.PENDING, nonce: 1, hash: '0xmissing2', raw: '0xraw_new', resendCount: 0, createdAtMs: 2000 },
    ];

    const r = await engine.run({ txs, provider: provider as any, addressValue: '0xaddr', now, maxResendCount: Number.POSITIVE_INFINITY });

    // Only the newest tx should be resent.
    const sendCalls = provider.rpc.request.mock.calls.filter((c) => c[0] === 'eth_sendRawTransaction');
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toEqual(['eth_sendRawTransaction', ['0xraw_new']]);

    const newPatch = r.patches.find((p) => p.txId === 'new')?.set ?? {};
    const oldPatch = r.patches.find((p) => p.txId === 'old')?.set ?? {};
    expect(newPatch.status).toBe(TxStatus.PENDING);
    expect(newPatch.resendCount).toBe(1);
    expect(oldPatch.status).toBe(TxStatus.DISCARDED);
  });
});
