import 'reflect-metadata';
import { type HardwareWalletCapabilities, type IHardwareWallet, NetworkType, type SigningContext } from '@core/types';
import type { HardwareAccount } from '@core/types/signer';
import { HardwareWalletRegistry } from './HardwareWalletRegistry';

const createAdapter = (capabilities: HardwareWalletCapabilities): IHardwareWallet => ({
  id: 'stub',
  type: 'stub',
  connect: jest.fn(async () => undefined),
  disconnect: jest.fn(async () => undefined),
  isConnected: jest.fn(async () => true),
  listAccounts: jest.fn(async (): Promise<HardwareAccount[]> => []),
  deriveAccount: jest.fn(async (): Promise<HardwareAccount> => ({ index: 0, address: '0x', chainType: NetworkType.Conflux })),
  deriveAddress: jest.fn(async () => '0x'),
  sign: jest.fn(async (context: SigningContext) => ({
    resultType: 'signature' as const,
    chainType: context.chainType,
    r: '0x0' as const,
    s: '0x0' as const,
    v: 0,
  })),
  getCapabilities: jest.fn(() => capabilities),
});

describe('HardwareWalletRegistry', () => {
  it('registers and retrieves adapters by normalized type', () => {
    const registry = new HardwareWalletRegistry();
    const adapter = createAdapter({ type: 'bsim' });

    registry.register('BSIM', undefined, adapter);

    expect(registry.size).toBe(1);
    expect(registry.get('bsim')).toBe(adapter);
    expect(registry.has('BSIM')).toBe(true);
  });

  it('allows separate adapters per hardwareId', () => {
    const registry = new HardwareWalletRegistry();
    const first = createAdapter({ type: 'bsim' });
    const second = createAdapter({ type: 'bsim' });

    registry.register('bsim', 'device-a', first);
    registry.register('bsim', 'device-b', second);

    expect(registry.get('bsim', 'device-b')).toBe(second);
    expect(registry.size).toBe(2);
  });

  it('throws on duplicate registrations for same type and hardwareId', () => {
    const registry = new HardwareWalletRegistry();
    registry.register('bsim', undefined, createAdapter({ type: 'bsim' }));

    expect(() => registry.register('BSIM', undefined, createAdapter({ type: 'bsim' }))).toThrow(
      '[HardwareWalletRegistry] Adapter already registered for type BSIM (hardwareId=<default>)',
    );
  });

  it('lists shallow copies with live capability lookups', () => {
    const registry = new HardwareWalletRegistry();
    const adapter = createAdapter({ type: 'bsim' });
    registry.register('bsim', undefined, adapter);

    const first = registry.list();
    expect(first).toEqual([{ type: 'bsim', hardwareId: undefined, capabilities: { type: 'bsim' } }]);
    first[0].type = 'mutated';

    adapter.getCapabilities = jest.fn(() => ({ type: 'bsim' }));
    const second = registry.list();
    expect(second[0].type).toBe('bsim');
    expect(second[0].hardwareId).toBeUndefined();
    expect(adapter.getCapabilities).toHaveBeenCalled();
  });
});
