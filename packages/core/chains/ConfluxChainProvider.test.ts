import { fetchChain } from '@cfx-kit/dapp-utils/dist/fetch';
import { ConfluxChainProvider, type ConfluxChainProviderOptions, hexToNumber } from './ConfluxChainProvider';
import { TxStatus } from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { convertBase32ToHex, convertHexToBase32 } from '@core/utils/address';
import { checksum } from 'ox/Address';

jest.mock('@cfx-kit/dapp-utils/dist/fetch', () => ({
  fetchChain: jest.fn(),
}));

const mockedFetchChain = fetchChain as jest.MockedFunction<typeof fetchChain>;

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
    mockedFetchChain.mockReset();
  });

  it('requires chainId, endpoint, and positive netId', () => {
    expect(() => createProvider({ chainId: '' })).toThrow('chainId is required');
    expect(() => createProvider({ endpoint: '' })).toThrow('endpoint is required');
    expect(() => createProvider({ netId: 0 })).toThrow('netId must be a positive integer');
  });

  it('derives base32 address by default and hex when requested', () => {
    const provider = createProvider();

    const base32 = provider.deriveAddress(SAMPLE_PRIVATE_KEY);
    expect(base32).toBe(SAMPLE_ACCOUNT_BASE32);

    const hex = provider.deriveAddress(SAMPLE_PRIVATE_KEY, { format: 'hex' });
    expect(hex).toBe(SAMPLE_ACCOUNT_HEX);
  });

  it('validates only base32 Conflux addresses', () => {
    const provider = createProvider();

    expect(provider.validateAddress(SAMPLE_ACCOUNT_BASE32)).toBe(true);
    expect(provider.validateAddress(SAMPLE_ACCOUNT_HEX)).toBe(false);
    expect(provider.validateAddress(convertHexToBase32(SAMPLE_ACCOUNT_HEX, 1))).toBe(false);
    expect(provider.validateAddress('0x0123456789abcdef0123456789abcdef01234567')).toBe(false);
    expect(provider.validateAddress('cfx:invalid-address')).toBe(false);
  });

  it('normalizes addresses for ABI use', () => {
    const provider = createProvider();

    expect(provider.prepareAddressForAbi(SAMPLE_ACCOUNT_BASE32)).toBe(SAMPLE_ACCOUNT_HEX);
    expect(provider.prepareAddressForAbi(SAMPLE_ACCOUNT_HEX)).toBe(SAMPLE_ACCOUNT_HEX);
  });

  it('fetches balances using base32 formatting', async () => {
    const provider = createProvider();
    mockedFetchChain.mockResolvedValueOnce('0x10');

    const balance = await provider.getBalance(SAMPLE_ACCOUNT_HEX);

    expect(balance).toBe('0x10');
    expect(mockedFetchChain).toHaveBeenCalledWith({
      url: TEST_ENDPOINT,
      method: 'cfx_getBalance',
      params: [SAMPLE_ACCOUNT_BASE32, 'latest_state'],
    });
  });

  it('fetches nonce and converts response to number', async () => {
    const provider = createProvider();
    mockedFetchChain.mockResolvedValueOnce('0x1a');

    const nonce = await provider.getNonce(SAMPLE_ACCOUNT_BASE32);

    expect(nonce).toBe(26);
    expect(mockedFetchChain).toHaveBeenCalledWith({
      url: TEST_ENDPOINT,
      method: 'cfx_getNextNonce',
      params: [SAMPLE_ACCOUNT_BASE32, 'latest_state'],
    });
  });

  it('returns transaction status based on receipt outcome', async () => {
    const provider = createProvider();

    mockedFetchChain.mockResolvedValueOnce({ outcomeStatus: '0x0' });
    await expect(provider.getTransactionStatus(SAMPLE_TX_HASH)).resolves.toBe(TxStatus.Confirmed);

    mockedFetchChain.mockResolvedValueOnce({ outcomeStatus: '0x1' });
    await expect(provider.getTransactionStatus(SAMPLE_TX_HASH)).resolves.toBe(TxStatus.Failed);

    mockedFetchChain.mockResolvedValueOnce(null);
    await expect(provider.getTransactionStatus(SAMPLE_TX_HASH)).resolves.toBe(TxStatus.Pending);

    mockedFetchChain.mockResolvedValueOnce({});
    await expect(provider.getTransactionStatus(SAMPLE_TX_HASH)).resolves.toBe(TxStatus.Pending);
  });

  it('retrieves epoch number and supports 1559 detection', async () => {
    const provider = createProvider();

    mockedFetchChain.mockResolvedValueOnce('0x100');
    await expect(provider.getEpochNumber()).resolves.toBe(256);

    mockedFetchChain.mockResolvedValueOnce({ baseFeePerGas: '0x1' });
    await expect(provider.isSupport1559()).resolves.toBe(true);

    mockedFetchChain.mockResolvedValueOnce(null);
    await expect(provider.isSupport1559()).resolves.toBe(false);
  });

  it('throws when RPC call fails', async () => {
    const provider = createProvider();
    mockedFetchChain.mockRejectedValueOnce(new Error('rpc down'));

    await expect(provider.getBalance(SAMPLE_ACCOUNT_HEX)).rejects.toThrow('rpc down');
  });
});

describe('hexToNumber', () => {
  it('converts hex and decimal strings', () => {
    expect(hexToNumber('0x1a')).toBe(26);
    expect(hexToNumber('42')).toBe(42);
  });

  it('rejects invalid values', () => {
    expect(() => hexToNumber('')).toThrow('Expected non-empty string');
    expect(() => hexToNumber('foo')).toThrow("Unable to convert value 'foo' to number");
  });
});

describe('ConfluxChainProvider integration helpers', () => {
  it('roundtrips base32 addresses via convertBase32ToHex', () => {
    const hex = convertBase32ToHex(SAMPLE_ACCOUNT_BASE32 as any);
    expect(checksum(hex)).toBe(SAMPLE_ACCOUNT_HEX);
  });
});
