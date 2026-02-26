import 'reflect-metadata';

import { ChainRegistry } from '@core/chains';
import { DEFAULT_ACCOUNTS_FIXTURE_BASE32 } from '@core/testUtils/fixtures';
import { StubChainProvider } from '@core/testUtils/mocks/chainProviders';
import type { IChainRpc } from '@core/types';
import { NetworkType } from '@core/types';
import { Container } from 'inversify';
import { AddressValidationService } from './AddressValidationService';

describe('AddressValidationService', () => {
  let container: Container;
  let chainRegistry: ChainRegistry;
  let service: AddressValidationService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    chainRegistry = new ChainRegistry();

    container.bind(ChainRegistry).toConstantValue(chainRegistry);
    container.bind(AddressValidationService).toSelf();

    service = container.get(AddressValidationService);
  });

  afterEach(() => {
    container.unbindAll();
    jest.clearAllMocks();
  });

  it('validates addresses using legacy rules', () => {
    expect(service.isValidAddress({ networkType: NetworkType.Conflux, addressValue: DEFAULT_ACCOUNTS_FIXTURE_BASE32 })).toBe(true);
    expect(service.isValidAddress({ networkType: NetworkType.Conflux, addressValue: 'cfx:invalid' })).toBe(false);

    expect(service.isValidAddress({ networkType: NetworkType.Ethereum, addressValue: '0x0000000000000000000000000000000000000001' })).toBe(true);
    expect(service.isValidAddress({ networkType: NetworkType.Ethereum, addressValue: '0x1234' })).toBe(false);
  });

  it('detects EVM contract by eth_getCode', async () => {
    const request: IChainRpc['request'] = jest.fn(async <T = unknown>(method: string): Promise<T> => {
      if (method === 'eth_getCode') return '0x1234' as unknown as T;
      throw new Error(`unexpected method: ${method}`);
    });
    const batch: IChainRpc['batch'] = jest.fn(async <T = unknown>(): Promise<T[]> => []);
    const rpc: IChainRpc = { request, batch };

    chainRegistry.register(new StubChainProvider({ chainId: '0x1', networkType: NetworkType.Ethereum, rpc }));

    await expect(
      service.isContractAddress({
        networkType: NetworkType.Ethereum,
        chainId: '0x1',
        addressValue: '0x0000000000000000000000000000000000000001',
      }),
    ).resolves.toBe(true);
  });

  it('treats empty EVM code as EOA', async () => {
    const request: IChainRpc['request'] = jest.fn(async <T = unknown>(method: string): Promise<T> => {
      if (method === 'eth_getCode') return '0x' as unknown as T;
      throw new Error(`unexpected method: ${method}`);
    });
    const batch: IChainRpc['batch'] = jest.fn(async <T = unknown>(): Promise<T[]> => []);
    const rpc: IChainRpc = { request, batch };

    chainRegistry.register(new StubChainProvider({ chainId: '0x1', networkType: NetworkType.Ethereum, rpc }));

    await expect(
      service.isContractAddress({
        networkType: NetworkType.Ethereum,
        chainId: '0x1',
        addressValue: '0x0000000000000000000000000000000000000001',
      }),
    ).resolves.toBe(false);
  });

  it('propagates RPC errors for EVM contract detection', async () => {
    const request: IChainRpc['request'] = jest.fn(async (): Promise<unknown> => {
      throw new Error('timed out');
    });
    const batch: IChainRpc['batch'] = jest.fn(async <T = unknown>(): Promise<T[]> => []);
    const rpc: IChainRpc = { request, batch };

    chainRegistry.register(new StubChainProvider({ chainId: '0x1', networkType: NetworkType.Ethereum, rpc }));

    await expect(
      service.isContractAddress({
        networkType: NetworkType.Ethereum,
        chainId: '0x1',
        addressValue: '0x0000000000000000000000000000000000000001',
      }),
    ).rejects.toThrow('timed out');
  });
});
