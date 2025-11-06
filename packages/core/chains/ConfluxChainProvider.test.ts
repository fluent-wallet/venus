import { ConfluxChainProvider, type ConfluxChainProviderOptions } from './ConfluxChainProvider';
import { AssetType, NetworkType } from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { checksum } from 'ox/Address';
import { PersonalMessage } from 'js-conflux-sdk';

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
const OTHER_PRIVATE_KEY = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const OTHER_ACCOUNT_HEX = checksum(toAccountAddress(computeAddress(OTHER_PRIVATE_KEY)));
const OTHER_ACCOUNT_BASE32 = convertHexToBase32(OTHER_ACCOUNT_HEX, TEST_NET_ID);
const MESSAGE = 'Venus rocks Conflux!';


const TOKEN_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
const NFT_CONTRACT = 'cfxtest:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv';
const ERC1155_CONTRACT = 'cfxtest:acc8mtwgyrv97rf2ycvg9tee93a7gxs3ea1vb05d31';
const NFT_TOKEN_ID = '12345';
const ERC1155_TOKEN_ID = '67890';

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
    mockRpc.getNextNonce.mockResolvedValue(1n);
    mockRpc.getEpochNumber.mockResolvedValue(100n);
    mockRpc.getGasPrice.mockResolvedValue(1n);
    mockRpc.getBalance.mockResolvedValue(0n);
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
    expect(balance).toBe(16n);
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

  it('signs personal messages with Conflux prefix', async () => {
    const provider = createProvider();
    const signature = await provider.signMessage(MESSAGE, { privateKey: SAMPLE_PRIVATE_KEY });
    const expected = PersonalMessage.sign(SAMPLE_PRIVATE_KEY, MESSAGE);
    expect(signature).toBe(expected);
  });

  it('throws when signing personal message without private key', async () => {
    const provider = createProvider();
    await expect(provider.signMessage(MESSAGE, {} as never)).rejects.toThrow('Conflux signing requires privateKey');
  });

  it('verifies personal message signatures for base32 addresses', () => {
    const provider = createProvider();
    const signature = PersonalMessage.sign(SAMPLE_PRIVATE_KEY, MESSAGE);
    expect(provider.verifyMessage(MESSAGE, signature, SAMPLE_ACCOUNT_BASE32)).toBe(true);
  });

  it('rejects hex addresses in verifyMessage', () => {
    const provider = createProvider();
    const signature = PersonalMessage.sign(SAMPLE_PRIVATE_KEY, MESSAGE);
    expect(provider.verifyMessage(MESSAGE, signature, SAMPLE_ACCOUNT_HEX)).toBe(false);
  });

  it('fails verification when address does not match signer', () => {
    const provider = createProvider();
    const signature = PersonalMessage.sign(SAMPLE_PRIVATE_KEY, MESSAGE);
    expect(provider.verifyMessage(MESSAGE, signature, OTHER_ACCOUNT_BASE32)).toBe(false);
  });

  it('fails verification when netId mismatches', () => {
    const provider = createProvider();
    const signature = PersonalMessage.sign(SAMPLE_PRIVATE_KEY, MESSAGE);
    const mismatchedNet = convertHexToBase32(SAMPLE_ACCOUNT_HEX, 1);
    expect(provider.verifyMessage(MESSAGE, signature, mismatchedNet)).toBe(false);
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

  it('rejects broadcast when SDK throws error', async () => {
    const provider = createProvider();
    mockSendRawTransaction.mockRejectedValueOnce(new Error('Network error'));

    await expect(
      provider.broadcastTransaction({
        chainType: NetworkType.Conflux,
        rawTransaction: '0xdeadbeef',
        hash: '0xabcd',
      }),
    ).rejects.toThrow('Network error');
  });

  describe('Token Transfers', () => {
    it('builds ERC20 transfer transactions', async () => {
      const provider = createProvider();

      const tx = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '100',
        assetType: AssetType.ERC20,
        assetDecimals: 6,
        contractAddress: TOKEN_CONTRACT,
      });

      expect(tx.chainType).toBe(NetworkType.Conflux);
      expect(tx.payload.from).toBe(SAMPLE_ACCOUNT_BASE32);
      expect(tx.payload.to).toBe(TOKEN_CONTRACT);
      expect(tx.payload.value).toBe('0x0');
      expect(tx.payload.data).toContain('a9059cbb'); // transfer(address,uint256) selector
      expect(tx.payload.data.length).toBeGreaterThan(10);
    });

    it('builds ERC721 transfer transactions', async () => {
      const provider = createProvider();

      const tx = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '1',
        assetType: AssetType.ERC721,
        assetDecimals: 0,
        contractAddress: NFT_CONTRACT,
        nftTokenId: NFT_TOKEN_ID,
      });

      expect(tx.chainType).toBe(NetworkType.Conflux);
      expect(tx.payload.to).toBe(NFT_CONTRACT);
      expect(tx.payload.value).toBe('0x0');
      expect(tx.payload.data).toContain('23b872dd'); // transferFrom(address,address,uint256) selector
    });

    it('builds ERC1155 transfer transactions', async () => {
      const provider = createProvider();

      const tx = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '5',
        assetType: AssetType.ERC1155,
        assetDecimals: 0,
        contractAddress: ERC1155_CONTRACT,
        nftTokenId: ERC1155_TOKEN_ID,
      });

      expect(tx.chainType).toBe(NetworkType.Conflux);
      expect(tx.payload.to).toBe(ERC1155_CONTRACT);
      expect(tx.payload.value).toBe('0x0');
      expect(tx.payload.data).toContain('f242432a'); // safeTransferFrom selector
    });

    it('estimates fee for ERC20 contract calls', async () => {
      const provider = createProvider();
      const unsigned = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '100',
        assetType: AssetType.ERC20,
        assetDecimals: 6,
        contractAddress: TOKEN_CONTRACT,
      });

      mockRpc.estimateGasAndCollateral.mockResolvedValueOnce({
        gasUsed: 0x7530n, // 30000
        storageCollateralized: 0n,
      });
      mockRpc.getGasPrice.mockResolvedValueOnce(1n);

      const estimate = await provider.estimateFee(unsigned);

      expect(estimate.chainType).toBe(NetworkType.Conflux);
      expect(estimate.gasLimit).toBe('0x7530');
      expect(mockRpc.estimateGasAndCollateral).toHaveBeenCalledWith({
        from: SAMPLE_ACCOUNT_BASE32,
        to: TOKEN_CONTRACT,
        data: unsigned.payload.data,
        value: '0x0',
      });
    });

    it('estimates fee with user-provided gasLimit and storageLimit', async () => {
      const provider = createProvider();
      const unsigned = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: SAMPLE_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
        gasLimit: '0x10000', // 65536
        storageLimit: '0x100', // 256
      });

      mockRpc.estimateGasAndCollateral.mockResolvedValueOnce({
        gasUsed: 0x5208n,
        storageCollateralized: 0n,
      });
      mockRpc.getGasPrice.mockResolvedValueOnce(2n);

      const estimate = await provider.estimateFee(unsigned);

      // Should use user-provided limits
      expect(estimate.gasLimit).toBe('0x10000');
      expect(estimate.storageLimit).toBe('0x100');
      expect(estimate.gasPrice).toBe('0x2');
      expect(estimate.estimatedTotal).toBe('0x20100'); // 0x10000 * 2 + 0x100
    });
  });

  describe('Integration Tests', () => {
    it('completes full transaction lifecycle: build → estimate → sign → broadcast', async () => {
      const provider = createProvider();

      // 1. Build
      const unsigned = await provider.buildTransaction({
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
      });

      expect(unsigned.payload.from).toBe(SAMPLE_ACCOUNT_BASE32);

      // 2. Estimate
      mockRpc.estimateGasAndCollateral.mockResolvedValueOnce({
        gasUsed: 0x5208n,
        storageCollateralized: 0n,
      });
      mockRpc.getGasPrice.mockResolvedValueOnce(1n);

      const estimate = await provider.estimateFee(unsigned);
      expect(estimate.gasLimit).toBe('0x5208');

      // 3. Sign
      mockSignTransaction.mockResolvedValueOnce({
        serialize: () => '0xsignedtx',
        hash: '0xtxhash',
      });

      const signed = await provider.signTransaction(unsigned, { privateKey: SAMPLE_PRIVATE_KEY });
      expect(signed.rawTransaction).toBe('0xsignedtx');
      expect(signed.hash).toBe('0xtxhash');

      // 4. Broadcast
      mockSendRawTransaction.mockResolvedValueOnce('0xtxhash');
      const txHash = await provider.broadcastTransaction(signed);
      expect(txHash).toBe('0xtxhash');
    });
  });
});
