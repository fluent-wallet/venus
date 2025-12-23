import 'reflect-metadata';
import { ChainRegistry } from '@core/chains';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError } from '@core/errors';
import { NetworkType, type ChainRpcRequestOptions, type IChainRpc } from '@core/types';
import { Container } from 'inversify';
import { ChainStatusService } from './ChainStatusService';

describe('ChainStatusService', () => {
  const CHAIN_ID = '1';

  const createRpcStub = (impl: (method: string, params?: unknown, options?: ChainRpcRequestOptions) => Promise<unknown>) => {
    const requestMock = jest.fn(async <T = unknown>(method: string, params?: unknown, options?: ChainRpcRequestOptions): Promise<T> => {
      return (await impl(method, params, options)) as T;
    });

    const rpc: IChainRpc = {
      request: requestMock as unknown as IChainRpc['request'],
      batch: jest.fn(async () => {
        throw new Error('not needed');
      }) as unknown as IChainRpc['batch'],
    };

    return { rpc, requestMock };
  };

  const createEvmProviderStub = (rpc: IChainRpc) => {
    return {
      chainId: CHAIN_ID,
      networkType: NetworkType.Ethereum,
      rpc,
      deriveAddress: jest.fn(),
      validateAddress: jest.fn(),
      buildTransaction: jest.fn(),
      estimateFee: jest.fn(),
      signTransaction: jest.fn(),
      broadcastTransaction: jest.fn(),
      getBalance: jest.fn(),
      call: jest.fn(),
      getNonce: jest.fn(),
      signMessage: jest.fn(),
      verifyMessage: jest.fn(),
    } as any;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('throws CHAIN_PROVIDER_NOT_FOUND when provider missing', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_PROVIDER_NOT_FOUND,
    });
  });

  it('caches within TTL and does not call rpc twice', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    const { rpc } = createRpcStub(async (method) => {
      if (method === 'eth_blockNumber') return '0x10';
      throw new Error('unexpected method');
    });

    registry.register(createEvmProviderStub(rpc));

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).resolves.toBe(16n);
    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).resolves.toBe(16n);

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith('eth_blockNumber', undefined, undefined);
  });

  it('refreshes after TTL expires', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    let value = 0x10;
    const { rpc } = createRpcStub(async (method) => {
      if (method === 'eth_blockNumber') return `0x${value.toString(16)}`;
      throw new Error('unexpected method');
    });
    registry.register(createEvmProviderStub(rpc));

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).resolves.toBe(16n);

    // within TTL (DEFAULT_TTL_MS = 1000)
    value = 0x11;
    jest.advanceTimersByTime(999);
    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).resolves.toBe(16n);
    expect(rpc.request).toHaveBeenCalledTimes(1);

    // after TTL
    jest.advanceTimersByTime(2);
    await expect(service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum })).resolves.toBe(17n);
    expect(rpc.request).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent calls (in-flight)', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    let resolveRpc: ((value: unknown) => void) | undefined;

    const { rpc } = createRpcStub(
      async (method) =>
        new Promise((resolve) => {
          if (method !== 'eth_blockNumber') throw new Error('unexpected method');
          resolveRpc = resolve;
        }),
    );

    registry.register(createEvmProviderStub(rpc));

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    const p1 = service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum });
    const p2 = service.getBlockNumber({ chainId: CHAIN_ID, networkType: NetworkType.Ethereum });

    expect(rpc.request).toHaveBeenCalledTimes(1);

    resolveRpc?.('0x20');

    await expect(p1).resolves.toBe(32n);
    await expect(p2).resolves.toBe(32n);
  });
  it('getEpochHeight(): passes latest_state by default', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    const { rpc, requestMock } = createRpcStub(async (method) => {
      if (method === 'cfx_epochNumber') return '0x10';
      throw new Error('unexpected method');
    });

    registry.register({
      chainId: CHAIN_ID,
      networkType: NetworkType.Conflux,
      rpc,
    } as any);

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    await expect(service.getEpochHeight({ chainId: CHAIN_ID, networkType: NetworkType.Conflux })).resolves.toBe(16n);
    expect(requestMock).toHaveBeenCalledWith('cfx_epochNumber', ['latest_state'], undefined);
  });

  it('getEpochHeight(): supports custom epochTag and caches per tag', async () => {
    const container = new Container({ defaultScope: 'Transient' });
    const registry = new ChainRegistry();

    const { rpc, requestMock } = createRpcStub(async (method, params) => {
      if (method !== 'cfx_epochNumber') throw new Error('unexpected method');
      if (Array.isArray(params) && params[0] === 'latest_state') return '0x10';
      if (Array.isArray(params) && params[0] === 'latest_confirmed') return '0x11';
      throw new Error('unexpected params');
    });

    registry.register({
      chainId: CHAIN_ID,
      networkType: NetworkType.Conflux,
      rpc,
    } as any);

    container.bind(ChainRegistry).toConstantValue(registry);
    container.bind(ChainStatusService).toSelf();

    const service = container.get(ChainStatusService);

    await expect(service.getEpochHeight({ chainId: CHAIN_ID, networkType: NetworkType.Conflux })).resolves.toBe(16n);
    await expect(service.getEpochHeight({ chainId: CHAIN_ID, networkType: NetworkType.Conflux }, { epochTag: 'latest_confirmed' })).resolves.toBe(17n);

    // same tag hits cache
    await expect(service.getEpochHeight({ chainId: CHAIN_ID, networkType: NetworkType.Conflux }, { epochTag: 'latest_confirmed' })).resolves.toBe(17n);

    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
