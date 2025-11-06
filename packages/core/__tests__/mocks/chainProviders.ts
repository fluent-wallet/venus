import type { ConfluxUnsignedTransactionPayload, EvmUnsignedTransactionPayload } from '@core/types';
import { NetworkType } from '@core/types';
import { checksum } from 'ox/Address';

export const DEFAULT_BASE32_ADDRESS = 'cfx:aamg0ss14e0xk1r3g3anzbeh2hgbjs7xtyx9ste4re';
export const DEFAULT_BASE32_ADDRESS_TEST = 'cfxtest:aamg0ss14e0xk1r3g3anzbeh2hgbjs7xty3y79cuks';
export const DEFAULT_HEX_ADDRESS = '0x146B39d7d12d34DDB93640bA8487C1Cc143bb37d';
export const DEFAULT_PRIVATE_KEY = '0xbb598b87b7799d0042d76978adf1594311a3c4dd257da94194d963c4bdfddc54';

export const DEFAULT_TEST_NET_20_TOKEN_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
export const DEFAULT_TEST_NFT_721_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
export const DEFAULT_TEST_NET_1155_CONTRACT = 'cfxtest:acc8mtwgyrv97rf2ycvg9tee93a7gxs3ea1vb05d31';
export const createMockConfluxSdk = () => {
  const rpc = {
    getBalance: jest.fn().mockResolvedValue(0n),
    getNextNonce: jest.fn().mockResolvedValue(0n),
    getEpochNumber: jest.fn().mockResolvedValue(0n),
    estimateGasAndCollateral: jest.fn().mockResolvedValue({ gasUsed: 21_000n, gasLimit: 21_000n, storageCollateralized: 0n }),
    getGasPrice: jest.fn().mockResolvedValue(1n),
  };

  return {
    sdk: {
      cfx: rpc,
      sendRawTransaction: jest.fn().mockResolvedValue('0xhash'),
    },
    rpc,
  };
};

export const createMockConfluxUnsignedTx = (overrides: Partial<ConfluxUnsignedTransactionPayload> = {}) => ({
  chainType: NetworkType.Conflux,
  payload: {
    from: DEFAULT_BASE32_ADDRESS,
    value: '0x1',
    data: '0x',
    chainId: '0x1',
    ...overrides,
  },
});

export const createMockEthersProvider = () => {
  const provider = {
    getBalance: jest.fn().mockResolvedValue(0n),
    getTransactionCount: jest.fn().mockResolvedValue(0),
    estimateGas: jest.fn().mockResolvedValue(21_000n),
    getFeeData: jest.fn().mockResolvedValue({ gasPrice: 1n, maxFeePerGas: 1n, maxPriorityFeePerGas: 1n }),
    broadcastTransaction: jest.fn().mockResolvedValue({ hash: '0xhash' }),
  };

  return { provider };
};

export const createMockEvmUnsignedTx = (overrides: Partial<EvmUnsignedTransactionPayload> = {}) => ({
  chainType: NetworkType.Ethereum,
  payload: {
    from: checksum(DEFAULT_HEX_ADDRESS),
    value: '0x1',
    data: '0x',
    chainId: '0x1',
    ...overrides,
  },
});
