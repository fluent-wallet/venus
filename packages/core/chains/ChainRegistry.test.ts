import type { ChainType, FeeEstimate, IChainProvider, SignedTransaction, UnsignedTransaction } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { ChainRegistry } from './ChainRegistry';

const CONFLUX_ADDRESS = '0x1000000000000000000000000000000000000000';
const EVM_ADDRESS = '0x2000000000000000000000000000000000000000';

const createConfluxUnsignedTx = (): UnsignedTransaction => ({
  chainType: NetworkType.Conflux,
  payload: {
    from: CONFLUX_ADDRESS,
    to: CONFLUX_ADDRESS,
    chainId: '0x1',
    value: '0x0',
    data: '0x',
    gasLimit: '0x5208',
    gasPrice: '0x1',
    storageLimit: '0x0',
    nonce: 0,
    epochHeight: 0,
  },
});

const createEvmUnsignedTx = (): UnsignedTransaction => ({
  chainType: NetworkType.Ethereum,
  payload: {
    from: EVM_ADDRESS,
    to: EVM_ADDRESS,
    chainId: '0x1',
    value: '0x0',
    data: '0x',
    gasLimit: '0x5208',
    gasPrice: '0x1',
    maxFeePerGas: '0x1',
    maxPriorityFeePerGas: '0x1',
    nonce: 0,
    type: 2,
  },
});

const createUnsignedTx = (chainType: ChainType): UnsignedTransaction => {
  if (chainType === NetworkType.Conflux) return createConfluxUnsignedTx();
  if (chainType === NetworkType.Ethereum) return createEvmUnsignedTx();
  return { chainType, payload: {}, context: {} };
};

const createFeeEstimate = (chainType: ChainType): FeeEstimate => {
  if (chainType === NetworkType.Conflux) {
    return {
      chainType,
      estimatedTotal: '0x5208',
      gasLimit: '0x5208',
      gasPrice: '0x1',
      storageLimit: '0x0',
    };
  }

  if (chainType === NetworkType.Ethereum) {
    return {
      chainType,
      estimatedTotal: '0x5208',
      gasLimit: '0x5208',
      gasPrice: '0x1',
      maxFeePerGas: '0x1',
      maxPriorityFeePerGas: '0x1',
    };
  }

  return {
    chainType,
    estimatedTotal: '0x0',
    gasLimit: '0x0',
  };
};

const createSignedTx = (chainType: ChainType): SignedTransaction => ({
  chainType,
  rawTransaction: '0x',
  hash: '0x',
});

const stubProvider = (overrides: Partial<IChainProvider> & { chainId?: string; networkType?: ChainType } = {}): IChainProvider => {
  const chainId = overrides.chainId ?? '0x1';
  const networkType = overrides.networkType ?? NetworkType.Conflux;

  return {
    chainId,
    networkType,
    deriveAddress: overrides.deriveAddress ?? (() => '0x'),
    validateAddress: overrides.validateAddress ?? (() => true),
    buildTransaction: overrides.buildTransaction ?? (async () => createUnsignedTx(networkType)),
    estimateFee: overrides.estimateFee ?? (async () => createFeeEstimate(networkType)),
    signTransaction: overrides.signTransaction ?? (async () => createSignedTx(networkType)),
    broadcastTransaction: overrides.broadcastTransaction ?? (async () => '0x'),
    getBalance: overrides.getBalance ?? (async () => '0'),
    getNonce: overrides.getNonce ?? (async () => 0),
    signMessage: overrides.signMessage ?? (async () => '0x'),
    verifyMessage: overrides.verifyMessage ?? (() => true),
  };
};

describe('ChainRegistry', () => {
  it('registers and retrieves providers by composite key', () => {
    const registry = new ChainRegistry();
    const conflux = stubProvider({ chainId: '0x1', networkType: NetworkType.Conflux });
    const ethereum = stubProvider({ chainId: '0x1', networkType: NetworkType.Ethereum });

    registry.register(conflux).register(ethereum);

    expect(registry.size).toBe(2);
    expect(registry.get('0x1', NetworkType.Conflux)).toBe(conflux);
    expect(registry.get('0x1', NetworkType.Ethereum)).toBe(ethereum);
  });

  it('throws when registering duplicate networkType + chainId', () => {
    const registry = new ChainRegistry();
    const conflux = stubProvider({ chainId: '0x1', networkType: NetworkType.Conflux });

    registry.register(conflux);
    expect(() => registry.register(stubProvider({ chainId: '0x1', networkType: NetworkType.Conflux }))).toThrow('Chain already registered: Conflux (0x1)');
  });

  it('warns about ambiguous lookup when networkType omitted', () => {
    const registry = new ChainRegistry();
    registry.register(stubProvider({ chainId: '0x1', networkType: NetworkType.Conflux }));
    registry.register(stubProvider({ chainId: '0x1', networkType: NetworkType.Ethereum }));

    expect(() => registry.get('0x1')).toThrow('Multiple providers found for chainId 0x1');
  });

  it('returns undefined when provider missing', () => {
    const registry = new ChainRegistry();
    expect(registry.get('0x2', NetworkType.Conflux)).toBeUndefined();
  });

  it('filters providers by type', () => {
    const registry = new ChainRegistry();
    const conflux = stubProvider({ chainId: '0x1', networkType: NetworkType.Conflux });
    const confluxTestnet = stubProvider({ chainId: '0x405', networkType: NetworkType.Conflux });
    registry.register(conflux).register(confluxTestnet);

    expect(registry.getByType(NetworkType.Conflux)).toEqual([conflux, confluxTestnet]);
  });

  it('checks presence using has()', () => {
    const registry = new ChainRegistry();
    registry.register(stubProvider({ chainId: '0x1', networkType: NetworkType.Ethereum }));

    expect(registry.has('0x1')).toBe(true);
    expect(registry.has('0x1', NetworkType.Ethereum)).toBe(true);
    expect(registry.has('0x1', NetworkType.Conflux)).toBe(false);
  });

  it('returns a shallow copy from getAll()', () => {
    const registry = new ChainRegistry();
    const provider = stubProvider({ chainId: '0x1', networkType: NetworkType.Ethereum });
    registry.register(provider);

    const all = registry.getAll();
    expect(all).toEqual([provider]);

    all.push(stubProvider({ chainId: '0x2', networkType: NetworkType.Conflux }));
    expect(registry.size).toBe(1);
  });
});
