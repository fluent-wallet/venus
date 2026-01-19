import type { HardwareConnectOptions, HardwareSignResult, HardwareWalletCapabilities, IHardwareWallet, SigningContext } from '@core/types';
import { NetworkType } from '@core/utils/consts';

/**
 * Lightweight IHardwareWallet mock for service/provider tests.
 */
export const createMockHardwareWallet = (): jest.Mocked<IHardwareWallet> => ({
  id: 'mock-hw',
  type: 'bsim',
  connect: jest.fn(async (_options?: HardwareConnectOptions) => undefined),
  disconnect: jest.fn(async () => undefined),
  isConnected: jest.fn(async () => true),
  listAccounts: jest.fn(async (_chainType: NetworkType) => []),
  deriveAccount: jest.fn(async (index: number, _chainType: NetworkType) => ({
    index,
    chainType: NetworkType.Ethereum,
    address: '0xdeadbeef',
    derivationPath: `m/44'/60'/0'/0/${index}`,
  })),
  deriveAddress: jest.fn(async (_path: string, _chainType: NetworkType) => '0xdeadbeef'),
  sign: jest.fn(
    async (_context: SigningContext): Promise<HardwareSignResult> => ({
      resultType: 'signature',
      chainType: NetworkType.Ethereum,
      r: '0x1',
      s: '0x2',
      v: 27,
    }),
  ),
  getCapabilities: jest.fn(() => ({ type: 'bsim' }) as HardwareWalletCapabilities),
});
