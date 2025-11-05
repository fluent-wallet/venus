import { ConfluxChainProvider, type ConfluxChainProviderOptions } from './ConfluxChainProvider';
import { AssetType, NetworkType } from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';

import { checksum } from 'ox/Address';

const mockRpc = {
  getBalance: jest.fn(),
  getNextNonce: jest.fn(),
  getTransactionReceipt: jest.fn(),
  getEpochNumber: jest.fn(),
  getBlockByEpochNumber: jest.fn(),
  estimateGasAndCollateral: jest.fn(),
  getGasPrice: jest.fn(),
};

const mockSendRawTransaction = jest.fn();
const mockSignTransaction = jest.fn();

jest.mock('js-conflux-sdk', () => {
  const actual = jest.requireActual('js-conflux-sdk');

  const mockPrivateKeyAccountConstructor = jest.fn().mockImplementation(() => ({
    signTransaction: mockSignTransaction,
  }));

  return {
    ...actual,
    Conflux: jest.fn().mockImplementation(() => ({
      cfx: mockRpc,
      sendRawTransaction: mockSendRawTransaction,
    })),
    PrivateKeyAccount: mockPrivateKeyAccountConstructor,
  };
});

const { PrivateKeyAccount: MockedPrivateKeyAccount } = jest.requireMock('js-conflux-sdk');

const TEST_ENDPOINT = 'https://rpc.example/conflux';
const TEST_CHAIN_ID = '1029';
const TEST_NET_ID = 1029;
const SAMPLE_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SAMPLE_ACCOUNT_HEX = checksum(toAccountAddress(computeAddress(SAMPLE_PRIVATE_KEY)));
const SAMPLE_ACCOUNT_BASE32 = convertHexToBase32(SAMPLE_ACCOUNT_HEX, TEST_NET_ID);
const SAMPLE_TX_HASH = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const createProvider = (overrides: Partial<ConfluxChainProviderOptions> = {}) =>
  new ConfluxChainProvider({
    chainId: TEST_CHAIN_ID,
    endpoint: TEST_ENDPOINT,
    netId: TEST_NET_ID,
    ...overrides,
  });

describe('ConfluxChainProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.getNextNonce.mockResolvedValue('0x1');
    mockRpc.getEpochNumber.mockResolvedValue('0x64'); // 100
    mockRpc.getGasPrice.mockResolvedValue('0x1');
    mockRpc.getBalance.mockResolvedValue('0x0');
    mockRpc.estimateGasAndCollateral.mockResolvedValue({
      gasUsed: '0x5208',
      storageCollateralized: '0x0',
    });
    mockSendRawTransaction.mockReset();
    mockSignTransaction.mockReset();
    (MockedPrivateKeyAccount as jest.Mock).mockClear();
  });

  it('requires chainId, endpoint, and positive netId', () => {
    expect(() => createProvider({ chainId: '' })).toThrow('chainId is required');
    expect(() => createProvider({ endpoint: '' })).toThrow('endpoint is required');
    expect(() => createProvider({ netId: 0 })).toThrow('netId must be a positive integer');
  });

  it('derives base32 address from public key', () => {
    const provider = createProvider();
    const derived = provider.deriveAddress(SAMPLE_PRIVATE_KEY);
    expect(derived).toBe(SAMPLE_ACCOUNT_BASE32);
  });

  it('validates only base32 Conflux addresses', () => {
    const provider = createProvider();

    expect(provider.validateAddress(SAMPLE_ACCOUNT_BASE32)).toBe(true);
    expect(provider.validateAddress(SAMPLE_ACCOUNT_HEX)).toBe(false);
    expect(provider.validateAddress(convertHexToBase32(SAMPLE_ACCOUNT_HEX, 1))).toBe(false);
    expect(provider.validateAddress('0x0123456789abcdef0123456789abcdef01234567')).toBe(false);
    expect(provider.validateAddress('cfx:invalid-address')).toBe(false);
  });

  it('fetches balances using base32 formatting', async () => {
    const provider = createProvider();
    mockRpc.getBalance.mockResolvedValueOnce(16n);
    const balance = await provider.getBalance(SAMPLE_ACCOUNT_BASE32);
    expect(balance).toBe('0x10');
    expect(mockRpc.getBalance).toHaveBeenCalledWith(SAMPLE_ACCOUNT_BASE32, 'latest_state');
  });

  it('fetches nonce and converts response to number', async () => {
    const provider = createProvider();
    mockRpc.getNextNonce.mockResolvedValueOnce(26n);
    const nonce = await provider.getNonce(SAMPLE_ACCOUNT_BASE32);
    expect(nonce).toBe(26);
    expect(mockRpc.getNextNonce).toHaveBeenCalledWith(SAMPLE_ACCOUNT_BASE32, 'latest_state');
  });

  it('builds native transfer transactions with auto-filled nonce and epoch height', async () => {
    const provider = createProvider();
    mockRpc.getNextNonce.mockResolvedValueOnce(1n);
    mockRpc.getEpochNumber.mockResolvedValueOnce(100n);

    const tx = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      chainId: TEST_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    expect(tx.chainType).toBe(NetworkType.Conflux);
    expect(tx.payload.from).toBe(SAMPLE_ACCOUNT_BASE32);
    expect(tx.payload.value).toBe('0xde0b6b3a7640000');
    expect(tx.payload.data).toBe('0x');
    expect(tx.payload.nonce).toBe(1);
    expect(tx.payload.epochHeight).toBe(100);
  });

  it('estimates fee using sdk helpers when gas values missing', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      chainId: TEST_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    mockRpc.estimateGasAndCollateral.mockResolvedValueOnce({
      gasUsed: 0x5208n,
      storageCollateralized: 0n,
    });
    mockRpc.getGasPrice.mockResolvedValueOnce(1n);

    const estimate = await provider.estimateFee(unsigned);

    expect(estimate).toEqual({
      chainType: NetworkType.Conflux,
      gasLimit: '0x5208',
      gasPrice: '0x1',
      storageLimit: '0x0',
      estimatedTotal: '0x5208',
    });
    expect(mockRpc.estimateGasAndCollateral).toHaveBeenCalledWith({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      data: '0x',
      value: '0xde0b6b3a7640000',
    });
  });

  it('signs transactions with PrivateKeyAccount and returns raw payload', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      chainId: TEST_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    mockSignTransaction.mockResolvedValueOnce({
      serialize: () => '0xdeadbeef',
      hash: '0xabcd',
    });

    const signed = await provider.signTransaction(unsigned, { privateKey: SAMPLE_PRIVATE_KEY });

    expect(MockedPrivateKeyAccount).toHaveBeenCalledWith(SAMPLE_PRIVATE_KEY, TEST_NET_ID);
    expect(mockSignTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        from: SAMPLE_ACCOUNT_BASE32,
        gas: unsigned.payload.gasLimit,
        gasPrice: unsigned.payload.gasPrice,
        storageLimit: unsigned.payload.storageLimit,
      }),
    );

    expect(signed).toEqual({
      chainType: NetworkType.Conflux,
      rawTransaction: '0xdeadbeef',
      hash: '0xabcd',
    });
  });

  it('broadcasts signed transactions via SDK client', async () => {
    const provider = createProvider();
    mockSendRawTransaction.mockResolvedValueOnce('0xhash');

    await expect(
      provider.broadcastTransaction({
        chainType: NetworkType.Conflux,
        rawTransaction: '0xdeadbeef',
        hash: '0xabcd',
      }),
    ).resolves.toBe('0xhash');

    expect(mockSendRawTransaction).toHaveBeenCalledWith('0xdeadbeef');
  });
});
