import type { ChainType, FeeEstimate, IChainProvider, SignedTransaction, UnsignedTransaction } from '@core/types';
import { TxStatus } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { ChainRegistry } from './ChainRegistry';

const defaultUnsignedTx: UnsignedTransaction = { chainType: NetworkType.Conflux, data: {} };
const defaultFeeEstimate: FeeEstimate = {
  gasLimit: '0x5208',
  maxFeePerGas: '0x1',
  maxPriorityFeePerGas: '0x1',
  estimatedTotal: '0x5208',
};
const defaultSignedTx: SignedTransaction = {
  chainType: NetworkType.Conflux,
  rawTransaction: '0x',
  hash: '0x',
};

const stubProvider = (overrides: Partial<IChainProvider> & { chainId?: string; networkType?: ChainType } = {}): IChainProvider => {
  const chainId = overrides.chainId ?? '0x1';
  const networkType = overrides.networkType ?? NetworkType.Conflux;

  return {
    chainId,
    networkType,
    deriveAddress: overrides.deriveAddress ?? (() => '0x'),
    validateAddress: overrides.validateAddress ?? (() => true),
    prepareAddressForAbi: overrides.prepareAddressForAbi ?? ((value) => value),
    buildTransaction: overrides.buildTransaction ?? (async () => ({ ...defaultUnsignedTx, chainType: networkType })),
    estimateFee: overrides.estimateFee ?? (async () => defaultFeeEstimate),
    signTransaction: overrides.signTransaction ?? (async () => ({ ...defaultSignedTx, chainType: networkType })),
    broadcastTransaction: overrides.broadcastTransaction ?? (async () => '0x'),
    getBalance: overrides.getBalance ?? (async () => '0'),
    getTransactionStatus: overrides.getTransactionStatus ?? (async () => TxStatus.Pending),
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
