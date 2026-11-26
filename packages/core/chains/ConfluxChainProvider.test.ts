import 'reflect-metadata';
import { iface777 } from '@core/contracts';
import { SoftwareSigner } from '@core/signers';
import {
  createMockConfluxRpc,
  DEFAULT_PRIVATE_KEY,
  DEFAULT_TEST_NET_20_TOKEN_CONTRACT,
  DEFAULT_TEST_NET_1155_CONTRACT,
  DEFAULT_TEST_NFT_721_CONTRACT,
} from '@core/testUtils/mocks';
import { AssetType, type ConfluxUnsignedTransaction, NetworkType } from '@core/types';
import { computeAddress, toAccountAddress } from '@core/utils/account';
import { hexAddressToBase32 } from 'cive/utils';
import { SigningKey } from 'ethers';
import { checksum } from 'ox/Address';
import { ConfluxChainProvider, type ConfluxChainProviderOptions } from './ConfluxChainProvider';
import { EndpointManager } from './EndpointManager';

let mockRpc: ReturnType<typeof createMockConfluxRpc>;

const TEST_ENDPOINT = 'https://rpc.example/conflux';
const TEST_NETWORK_ID = 'net_cfx_1029';
const TEST_CHAIN_ID = '1029';
const TEST_NET_ID = 1029;
const SAMPLE_PRIVATE_KEY = DEFAULT_PRIVATE_KEY;
const SAMPLE_ACCOUNT_HEX = checksum(toAccountAddress(computeAddress(SAMPLE_PRIVATE_KEY)));
const SAMPLE_ACCOUNT_BASE32 = hexAddressToBase32({ hexAddress: SAMPLE_ACCOUNT_HEX as `0x${string}`, networkId: TEST_NET_ID });
const OTHER_PRIVATE_KEY = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const OTHER_ACCOUNT_HEX = checksum(toAccountAddress(computeAddress(OTHER_PRIVATE_KEY)));
const OTHER_ACCOUNT_BASE32 = hexAddressToBase32({ hexAddress: OTHER_ACCOUNT_HEX as `0x${string}`, networkId: TEST_NET_ID });
const MESSAGE = 'Venus rocks Conflux!';
// Reference signatures generated with js-conflux-sdk 2.5.0.
const MESSAGE_SIGNATURE =
  '0xaf5928d1f3422f82c0895e56f7eeb43aed1943d6eab8ca2bcfd20f82866926c3467c4297c05e90d34e60c005fa37b9d16a3acc53af79213b171e43ec440233a301';
const OTHER_MESSAGE_SIGNATURE =
  '0xc8c61ad96014e2d4fca0f795a09cf4e4578d2ae7b287d68e3ed93c1c9d4d94560c896f1fc8a4bb45f23e4f3f1bca252325adeacccf062bcafb3b2561c50bbf2900';

const TOKEN_CONTRACT = DEFAULT_TEST_NET_20_TOKEN_CONTRACT;
const NFT_CONTRACT = DEFAULT_TEST_NFT_721_CONTRACT;
const ERC1155_CONTRACT = DEFAULT_TEST_NET_1155_CONTRACT;
const NFT_TOKEN_ID = '12345';
const ERC1155_TOKEN_ID = '67890';

const createProvider = (overrides: Partial<ConfluxChainProviderOptions> = {}) => {
  const endpointManager = overrides.endpointManager ?? new EndpointManager();
  const networkId = overrides.networkId ?? TEST_NETWORK_ID;

  endpointManager.setEndpoint(networkId, TEST_ENDPOINT);

  const provider = new ConfluxChainProvider({
    chainId: overrides.chainId ?? TEST_CHAIN_ID,
    netId: overrides.netId ?? TEST_NET_ID,
    networkId,
    endpointManager,
  });
  jest.spyOn(provider.rpc, 'request').mockImplementation(mockRpc.request);
  return provider;
};

describe('ConfluxChainProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc = createMockConfluxRpc();
    mockRpc.responses.cfx_getNextNonce = '0x1';
    mockRpc.responses.cfx_epochNumber = '0x64';
  });

  it('derives base32 address from public key', () => {
    const provider = createProvider();
    const publicKey = SigningKey.computePublicKey(SAMPLE_PRIVATE_KEY, false) as `0x${string}`;
    const derived = provider.deriveAddress(publicKey);
    expect(derived).toBe(SAMPLE_ACCOUNT_BASE32);
  });

  it('validates only base32 Conflux addresses', () => {
    const provider = createProvider();

    expect(provider.validateAddress(SAMPLE_ACCOUNT_BASE32)).toBe(true);
    expect(provider.validateAddress(SAMPLE_ACCOUNT_HEX)).toBe(false);
    expect(provider.validateAddress(hexAddressToBase32({ hexAddress: SAMPLE_ACCOUNT_HEX as `0x${string}`, networkId: 1 }))).toBe(false);
    expect(provider.validateAddress('0x0123456789abcdef0123456789abcdef01234567')).toBe(false);
    expect(provider.validateAddress('cfx:invalid-address')).toBe(false);
  });

  it('fetches balances using base32 formatting', async () => {
    const provider = createProvider();
    mockRpc.responses.cfx_getBalance = '0x10';
    const balance = await provider.getBalance(SAMPLE_ACCOUNT_BASE32);
    expect(balance).toBe('0x10');
    expect(mockRpc.request).toHaveBeenCalledWith('cfx_getBalance', [SAMPLE_ACCOUNT_BASE32, 'latest_state']);
  });

  it('preserves generic call bytes, including leading zeroes and empty data', async () => {
    const provider = createProvider();
    for (const raw of [`0x${'00'.repeat(31)}ff`, '0x']) {
      mockRpc.responses.cfx_call = raw;
      const result = await provider.call({ to: SAMPLE_ACCOUNT_BASE32, data: '0xdeadbeef' });
      expect(result).toBe(raw);
    }
    expect(mockRpc.request).toHaveBeenCalledWith('cfx_call', [{ to: SAMPLE_ACCOUNT_BASE32, data: '0xdeadbeef' }, 'latest_state']);
  });

  it('performs batch call through rpc client with latest_state tag', async () => {
    const provider = createProvider();
    const batchSpy = jest.spyOn(provider.rpc, 'batch').mockResolvedValueOnce(['0xff', '0x10']);

    const result = await provider.batchCall([
      { to: SAMPLE_ACCOUNT_BASE32, data: '0xdeadbeef' },
      { to: OTHER_ACCOUNT_BASE32, data: '0x12345678' },
    ]);

    expect(result).toEqual(['0xff', '0x10']);
    expect(batchSpy).toHaveBeenCalledWith([
      {
        method: 'cfx_call',
        params: [{ to: SAMPLE_ACCOUNT_BASE32, data: '0xdeadbeef' }, 'latest_state'],
      },
      {
        method: 'cfx_call',
        params: [{ to: OTHER_ACCOUNT_BASE32, data: '0x12345678' }, 'latest_state'],
      },
    ]);
  });

  it('reads fungible balances through batched Conflux RPC requests', async () => {
    const provider = createProvider();
    const batchSpy = jest.spyOn(provider.rpc, 'batch').mockResolvedValueOnce(['0x10', '0x20']);

    const result = await provider.readFungibleAssetBalances(SAMPLE_ACCOUNT_BASE32, [
      { assetType: AssetType.Native },
      { assetType: AssetType.ERC20, contractAddress: TOKEN_CONTRACT },
    ]);

    expect(result).toEqual(['0x10', '0x20']);
    expect(batchSpy).toHaveBeenCalledWith([
      {
        method: 'cfx_getBalance',
        params: [SAMPLE_ACCOUNT_BASE32, 'latest_state'],
      },
      {
        method: 'cfx_call',
        params: [
          {
            to: TOKEN_CONTRACT,
            data: iface777.encodeFunctionData('balanceOf', [SAMPLE_ACCOUNT_HEX]),
          },
          'latest_state',
        ],
      },
    ]);
  });

  it('fetches nonce and converts response to number', async () => {
    const provider = createProvider();
    mockRpc.responses.cfx_getNextNonce = '0x1a';
    const nonce = await provider.getNonce(SAMPLE_ACCOUNT_BASE32);
    expect(nonce).toBe(26);
    expect(mockRpc.request).toHaveBeenCalledWith('cfx_getNextNonce', [SAMPLE_ACCOUNT_BASE32, 'latest_state']);
  });

  it('builds native transfer transactions with auto-filled nonce and epoch height', async () => {
    const provider = createProvider();

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

  it('estimates fee through RPC when gas values are missing', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      chainId: TEST_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    const estimate = await provider.estimateFee(unsigned);

    expect(estimate).toEqual({
      chainType: NetworkType.Conflux,
      gasLimit: '0x5208',
      gasPrice: '0x1',
      storageLimit: '0x0',
      estimatedTotal: '0x5208',
    });
    expect(mockRpc.request).toHaveBeenCalledWith('cfx_estimateGasAndCollateral', [
      {
        from: SAMPLE_ACCOUNT_BASE32,
        to: SAMPLE_ACCOUNT_BASE32,
        data: '0x',
        value: '0xde0b6b3a7640000',
      },
      'latest_state',
    ]);
    expect(mockRpc.request).toHaveBeenCalledWith('cfx_gasPrice', []);
  });

  it('prepares unsigned drafts by filling nonce, epochHeight, and fee fields', async () => {
    const provider = createProvider();
    const draft: ConfluxUnsignedTransaction = {
      chainType: NetworkType.Conflux,
      payload: {
        from: SAMPLE_ACCOUNT_BASE32,
        to: SAMPLE_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        value: '0xde0b6b3a7640000',
        data: '0x',
      },
    };

    mockRpc.responses.cfx_getNextNonce = '0x9';
    mockRpc.responses.cfx_epochNumber = '0x7b';
    mockRpc.responses.cfx_gasPrice = '0x2';

    const prepared = await provider.prepareUnsignedTransaction(draft);

    expect(prepared.payload.nonce).toBe(9);
    expect(prepared.payload.epochHeight).toBe(123);
    expect(prepared.payload.gasLimit).toBe('0x5208');
    expect(prepared.payload.storageLimit).toBe('0x0');
    expect(prepared.payload.gasPrice).toBe('0x2');
  });

  it('matches the SDK reference transaction bytes and hash', async () => {
    const provider = createProvider();
    const unsigned = await provider.buildTransaction({
      from: SAMPLE_ACCOUNT_BASE32,
      to: SAMPLE_ACCOUNT_BASE32,
      chainId: TEST_CHAIN_ID,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    });

    const prepared = await provider.prepareUnsignedTransaction(unsigned);
    const signer = new SoftwareSigner(SAMPLE_PRIVATE_KEY);
    const signed = await provider.signTransaction(prepared, signer);

    // Generated with js-conflux-sdk 2.5.0 for the transaction above.
    expect(signed).toEqual({
      chainType: NetworkType.Conflux,
      rawTransaction:
        '0xf86de9010182520894146b39d7d12d34ddb93640ba8487c1cc143bb37d880de0b6b3a764000080648204058001a012fcc9c0b4f10989f9ee7646127fe6a260e394e4475e8c0a486a5e19c385a1d6a0108015e4fb662783f98b339d6f7d583e0fba6bddafb515bd800f35c4ce6c4093',
      hash: '0x614238b2c6dc3c49d31977da18db1f810c1da4cedfc854c0c352df22be304276',
    });
  });

  it('requires prepared signing fields while accepting zero values', async () => {
    const provider = createProvider();
    const signer = new SoftwareSigner(SAMPLE_PRIVATE_KEY);
    const complete: ConfluxUnsignedTransaction = {
      chainType: NetworkType.Conflux,
      payload: {
        from: SAMPLE_ACCOUNT_BASE32,
        to: OTHER_ACCOUNT_BASE32,
        chainId: TEST_CHAIN_ID,
        value: '0x0',
        data: '0x',
        gasLimit: '0x5208',
        gasPrice: '0x1',
        storageLimit: '0x0',
        nonce: 0,
        epochHeight: 100,
      },
    };

    await expect(provider.signTransaction(complete, signer)).resolves.toBeDefined();
    for (const field of ['gasLimit', 'gasPrice', 'storageLimit', 'nonce', 'epochHeight'] as const) {
      const incomplete = { ...complete, payload: { ...complete.payload, [field]: undefined } };
      await expect(provider.signTransaction(incomplete, signer)).rejects.toThrow('Conflux transaction must be prepared before signing.');
    }
  });

  it.each([
    [MESSAGE, MESSAGE_SIGNATURE],
    [
      '你好，Conflux 🌐',
      '0x521e68079421f83b7a052270c7df61bec6d7027c86d54f4908f8f504bf9c03656d81a16ef37c2065cb997ca3f5b28ea4ddc19cdd1710970ef468243303c5887301',
    ],
    ['', '0xa4bc7c3824beaf9781712feebc03ad4630ff819834b49b158dc7e7594c7c044c18236ae9cd528eab2aba6831786fb0a5c52827e3d19a4ef944a16627185d127c01'],
    ['0x', '0xa4bc7c3824beaf9781712feebc03ad4630ff819834b49b158dc7e7594c7c044c18236ae9cd528eab2aba6831786fb0a5c52827e3d19a4ef944a16627185d127c01'],
    ['0x56656e7573', '0xc3bd4945682672f8ded276a283baef5700dfadd2caf1064d2ccb171ee27a319840cfa82b28efdb845e1906fc9af3636734731d41bc3af3cddfc880818ff602f601'],
  ])('signs personal message %j with Conflux prefix', async (message, expected) => {
    const provider = createProvider();
    const signer = new SoftwareSigner(SAMPLE_PRIVATE_KEY);
    const signature = await provider.signMessage(message, signer);
    expect(signature).toBe(expected);
    await expect(provider.verifyMessage(message, signature, SAMPLE_ACCOUNT_BASE32)).resolves.toBe(true);
  });

  it('signs binary messages without UTF-8 conversion', async () => {
    const provider = createProvider();
    const signer = new SoftwareSigner(SAMPLE_PRIVATE_KEY);
    const signature = await provider.signMessage('0xff00', signer);

    expect(signature).toBe(
      '0xc7522d9cdac0974341454267111be00bb7299e7d34dd62932207bcc1208fa43c6e9bfc28e47e71f9f3a285aae23df6dc6582549af661cfd7de6634e13f88aa3700',
    );
    await expect(provider.verifyMessage('0xff00', signature, SAMPLE_ACCOUNT_BASE32)).resolves.toBe(true);
  });

  it('throws when creating SoftwareSigner without private key', () => {
    expect(() => new SoftwareSigner('')).toThrow('SoftwareSigner requires a private key');
  });

  it.each([
    { signature: MESSAGE_SIGNATURE, address: SAMPLE_ACCOUNT_BASE32 },
    { signature: OTHER_MESSAGE_SIGNATURE, address: OTHER_ACCOUNT_BASE32 },
  ])('verifies personal message signatures for $address', async ({ signature, address }) => {
    const provider = createProvider();
    await expect(provider.verifyMessage(MESSAGE, signature, address)).resolves.toBe(true);
    await expect(provider.verifyMessage(`${MESSAGE}!`, signature, address)).resolves.toBe(false);
  });

  it('rejects hex addresses in verifyMessage', async () => {
    const provider = createProvider();
    await expect(provider.verifyMessage(MESSAGE, MESSAGE_SIGNATURE, SAMPLE_ACCOUNT_HEX)).resolves.toBe(false);
  });

  it('fails verification when address does not match signer', async () => {
    const provider = createProvider();
    await expect(provider.verifyMessage(MESSAGE, MESSAGE_SIGNATURE, OTHER_ACCOUNT_BASE32)).resolves.toBe(false);
  });

  it('fails verification when netId mismatches', async () => {
    const provider = createProvider();
    const mismatchedNet = hexAddressToBase32({ hexAddress: SAMPLE_ACCOUNT_HEX as `0x${string}`, networkId: 1 });
    await expect(provider.verifyMessage(MESSAGE, MESSAGE_SIGNATURE, mismatchedNet)).resolves.toBe(false);
  });

  it('rejects contract addresses with the same trailing bytes as the signer', async () => {
    const provider = createProvider();
    const contractAddress = hexAddressToBase32({ hexAddress: `0x8${SAMPLE_ACCOUNT_HEX.slice(3)}`, networkId: TEST_NET_ID });

    await expect(provider.verifyMessage(MESSAGE, MESSAGE_SIGNATURE, contractAddress)).resolves.toBe(false);
  });

  it('returns false for malformed signatures', async () => {
    const provider = createProvider();

    await expect(provider.verifyMessage(MESSAGE, '0x', SAMPLE_ACCOUNT_BASE32)).resolves.toBe(false);
  });

  it('broadcasts signed transactions through RPC', async () => {
    const provider = createProvider();

    await expect(
      provider.broadcastTransaction({
        chainType: NetworkType.Conflux,
        rawTransaction: '0xdeadbeef',
        hash: '0xabcd',
      }),
    ).resolves.toBe('0xhash');

    expect(mockRpc.request).toHaveBeenCalledWith('cfx_sendRawTransaction', ['0xdeadbeef']);
  });

  it('rejects broadcast when RPC fails', async () => {
    const provider = createProvider();
    mockRpc.request.mockRejectedValueOnce(new Error('Network error'));

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

      mockRpc.responses.cfx_estimateGasAndCollateral = {
        gasUsed: '0x7530', // 30000
        storageCollateralized: '0x0',
      };

      const estimate = await provider.estimateFee(unsigned);

      expect(estimate.chainType).toBe(NetworkType.Conflux);
      expect(estimate.gasLimit).toBe('0x7530');
      expect(mockRpc.request).toHaveBeenCalledWith('cfx_estimateGasAndCollateral', [
        {
          from: SAMPLE_ACCOUNT_BASE32,
          to: TOKEN_CONTRACT,
          data: unsigned.payload.data,
          value: '0x0',
        },
        'latest_state',
      ]);
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

      mockRpc.responses.cfx_gasPrice = '0x2';

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

      // 2. Prepare
      const prepared = await provider.prepareUnsignedTransaction(unsigned);
      expect(prepared.payload.gasLimit).toBe('0x5208');

      // 3. Sign
      const signer = new SoftwareSigner(SAMPLE_PRIVATE_KEY);
      const signed = await provider.signTransaction(prepared, signer);

      // 4. Broadcast
      mockRpc.responses.cfx_sendRawTransaction = signed.hash;
      const txHash = await provider.broadcastTransaction(signed);
      expect(txHash).toBe(signed.hash);
      expect(mockRpc.request).toHaveBeenCalledWith('cfx_sendRawTransaction', [signed.rawTransaction]);
    });
  });
});
