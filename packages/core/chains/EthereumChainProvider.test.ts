import { EthereumChainProvider, type EthereumChainProviderOptions } from './EthereumChainProvider';
import { AssetType, NetworkType } from '@core/types';
import { JsonRpcProvider, Wallet } from 'ethers';

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');

  return {
    ...actual,
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn(),
  };
});

const MockedJsonRpcProvider = JsonRpcProvider as unknown as jest.Mock;
const MockedWallet = Wallet as unknown as jest.Mock;

const SAMPLE_ENDPOINT = 'https://rpc.example/ethereum';
const SAMPLE_CHAIN_ID = '1';
const SAMPLE_ACCOUNT = '0x1111111111111111111111111111111111111111';

const SAMPLE_PUBLIC_KEY =
  '0x040a25e77cb5b4922947ccc3bc4b6b410a9ea48c9af3fb81cfeb388c55f05c40d41e53259a6224c2cd41db70370601d59d16ab0f580d68807adcc484f3c18caff1';
const SAMPLE_PRIVATE_KEY = '169c15f185394116fa9b8909dd4edd22ce6629aad061fcb6c4348ff57988fa8d';
const EXPECTED_ADDRESS = "0x6DF223015040A93Ce17c591837aa308BCFc6A10c";
const providerStub = {
  getBalance: jest.fn(),
  getTransactionCount: jest.fn(),
  estimateGas: jest.fn(),
  getFeeData: jest.fn(),
  broadcastTransaction: jest.fn(),
};
const walletStub = {
  signTransaction: jest.fn(),
  signMessage: jest.fn(),
};

const createProvider = (overrides: Partial<EthereumChainProviderOptions> = {}) =>
  new EthereumChainProvider({
    chainId: SAMPLE_CHAIN_ID,
    endpoint: SAMPLE_ENDPOINT,
    ...overrides,
  });

describe('EthereumChainProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    providerStub.getBalance.mockReset().mockResolvedValue(16n);
    providerStub.getTransactionCount.mockReset().mockResolvedValue(7);
    providerStub.estimateGas.mockReset().mockResolvedValue(21_000n);
    providerStub.getFeeData.mockReset().mockResolvedValue({
      gasPrice: 1n,
      maxFeePerGas: 2n,
      maxPriorityFeePerGas: 1n,
    });
    providerStub.broadcastTransaction.mockReset().mockResolvedValue({ hash: '0xhash' });

    walletStub.signTransaction.mockReset().mockResolvedValue('0xdeadbeef');
    walletStub.signMessage.mockReset().mockResolvedValue('0xsigned');

    MockedJsonRpcProvider.mockImplementation(() => providerStub);
    MockedWallet.mockImplementation(() => walletStub);
  });

  it('rejects invalid chainId formats', () => {
    expect(() => createProvider({ chainId: '-1' })).toThrow('Invalid chainId');
    expect(() => createProvider({ chainId: 'abc' })).toThrow('Invalid chainId');
    expect(() => createProvider({ chainId: '0' })).toThrow('Invalid chainId');
  });
  it('requires chainId and endpoint', () => {
    expect(() => createProvider({ chainId: '' })).toThrow('chainId is required');
    expect(() => createProvider({ endpoint: '' })).toThrow('endpoint is required');
  });

  it('derives and validates checksum addresses', () => {
    const provider = createProvider();

    expect(provider.deriveAddress(SAMPLE_PUBLIC_KEY)).toBe(EXPECTED_ADDRESS);
    expect(provider.validateAddress(EXPECTED_ADDRESS)).toBe(true);
    expect(provider.validateAddress('0x123')).toBe(false);
  });

  it('builds native transfer with auto nonce', async () => {
    const provider = createProvider();

    const tx = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: SAMPLE_ACCOUNT,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    expect(providerStub.getTransactionCount).toHaveBeenCalledWith(SAMPLE_ACCOUNT, 'pending');
    expect(tx.payload.value).toBe('0xde0b6b3a7640000');
    expect(tx.payload.nonce).toBe(7);
    expect(tx.payload.type).toBeUndefined();
  });

  it('builds ERC20 transfer payload with contract address', async () => {
    const provider = createProvider();
    const contract = '0x2222222222222222222222222222222222222222';

    const tx = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: '0x3333333333333333333333333333333333333333',
      chainId: SAMPLE_CHAIN_ID,
      amount: '5',
      assetType: AssetType.ERC20,
      assetDecimals: 18,
      contractAddress: contract,
    });

    expect(tx.payload.to).toBe(contract);
    expect(tx.payload.value).toBe('0x0');
    expect(tx.payload.data.startsWith('0xa9059cbb')).toBe(true);
  });

  it('gets balance and nonce through provider', async () => {
    const provider = createProvider();

    const balance = await provider.getBalance(SAMPLE_ACCOUNT);
    const nonce = await provider.getNonce(SAMPLE_ACCOUNT);

    expect(balance).toBe(16n);
    expect(nonce).toBe(7);
    expect(providerStub.getBalance).toHaveBeenCalledWith(SAMPLE_ACCOUNT);
    expect(providerStub.getTransactionCount).toHaveBeenCalledWith(SAMPLE_ACCOUNT, 'pending');
  });

  it('estimates fee with EIP-1559 fields when available', async () => {
    const provider = createProvider();

    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: SAMPLE_ACCOUNT,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
      maxFeePerGas: '0x2',
      maxPriorityFeePerGas: '0x1',
    });

    const estimate = await provider.estimateFee(unsigned);

    expect(providerStub.estimateGas).toHaveBeenCalled();
    expect(estimate.gasLimit).toBe('0x5208');
    expect(estimate.maxFeePerGas).toBe('0x2');
    expect(estimate.maxPriorityFeePerGas).toBe('0x1');
    expect(estimate.gasPrice).toBeUndefined();
  });

  it('signs transaction using provided private key', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: SAMPLE_ACCOUNT,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    const signed = await provider.signTransaction(unsigned, { privateKey: SAMPLE_PRIVATE_KEY });

    expect(MockedWallet).toHaveBeenCalledWith(SAMPLE_PRIVATE_KEY, providerStub);
    expect(walletStub.signTransaction).toHaveBeenCalledWith(unsigned.payload);
    expect(signed.rawTransaction).toBe('0xdeadbeef');
    expect(signed.hash).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it('broadcasts signed transaction through provider', async () => {
    const provider = createProvider();
    const hash = await provider.broadcastTransaction({
      chainType: NetworkType.Ethereum,
      rawTransaction: '0xraw',
      hash: '0xhash',
    });

    expect(providerStub.broadcastTransaction).toHaveBeenCalledWith('0xraw');
    expect(hash).toBe('0xhash');
  });

  it('signs messages with wallet private key', async () => {
    const provider = createProvider();
    const signature = await provider.signMessage('hello', { privateKey: SAMPLE_PRIVATE_KEY });

    expect(MockedWallet).toHaveBeenCalledWith(SAMPLE_PRIVATE_KEY, providerStub);
    expect(walletStub.signMessage).toHaveBeenCalledWith('hello');
    expect(signature).toBe('0xsigned');
  });

  it('verifies signed messages', async () => {
    const provider = createProvider();
    const actual = jest.requireActual('ethers');
    const actualWallet = new actual.Wallet(SAMPLE_PRIVATE_KEY);

    const signature = await actualWallet.signMessage('venus');

    expect(provider.verifyMessage('venus', signature, actualWallet.address)).toBe(true);
    expect(provider.verifyMessage('venus', signature, '0x0000000000000000000000000000000000000000')).toBe(false);
  });

  it('builds ERC721 transfers and keeps zero value', async () => {
    const provider = createProvider();
    const contract = '0x4444444444444444444444444444444444444444';

    const tx = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: '0x5555555555555555555555555555555555555555',
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.ERC721,
      assetDecimals: 0,
      contractAddress: contract,
      nftTokenId: '123',
    });

    expect(tx.payload.to).toBe(contract);
    expect(tx.payload.value).toBe('0x0');
    expect(tx.payload.data.startsWith('0x23b872dd')).toBe(true);
  });

  it('builds ERC1155 transfers with token id and amount', async () => {
    const provider = createProvider();
    const contract = '0x6666666666666666666666666666666666666666';

    const tx = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: '0x7777777777777777777777777777777777777777',
      chainId: SAMPLE_CHAIN_ID,
      amount: '10',
      assetType: AssetType.ERC1155,
      assetDecimals: 0,
      contractAddress: contract,
      nftTokenId: '456',
    });

    expect(tx.payload.to).toBe(contract);
    expect(tx.payload.data.startsWith('0xf242432a')).toBe(true);
  });

  it('falls back to legacy gas when no 1559 fields provided', async () => {
    const provider = createProvider();

    providerStub.getFeeData.mockResolvedValueOnce({
      gasPrice: 3n,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null,
    });

    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: SAMPLE_ACCOUNT,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
      gasPrice: '0x3',
    });

    const estimate = await provider.estimateFee(unsigned);

    expect(estimate.gasPrice).toBe('0x3');
    expect(estimate.maxFeePerGas).toBeUndefined();
    expect(estimate.maxPriorityFeePerGas).toBeUndefined();
  });

  it('throws when signing without private key', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT,
      to: SAMPLE_ACCOUNT,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    await expect(provider.signTransaction(unsigned, {})).rejects.toThrow('Signer must provide a privateKey');
  });

  it('prefers EIP-1559 type when both gasPrice and maxFeePerGas provided', async () => {
    const provider = createProvider();
    const tx = await provider.buildTransaction({
      from: EXPECTED_ADDRESS,
      to: EXPECTED_ADDRESS,
      chainId: SAMPLE_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
      gasPrice: '0x3',
      maxFeePerGas: '0x4',
    });

    expect(tx.payload.type).toBe(2);
  });
});
