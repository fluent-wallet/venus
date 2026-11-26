import 'reflect-metadata';
import { SoftwareSigner } from '@core/signers';

const mockRpcRequest = jest.fn();
const mockCheckIsContractAddress = jest.fn();

jest.mock('@core/rpc', () => ({
  HttpJsonRpcClient: jest.fn().mockImplementation(() => ({ request: (...args: unknown[]) => mockRpcRequest(...args) })),
}));

jest.mock('@core/WalletCore/Methods', () => ({
  checkIsContractAddress: (...args: unknown[]) => mockCheckIsContractAddress(...args),
}));

import type { Network } from '@core/database/models/Network';
import {
  createMockConfluxRpc,
  createMockEthersProvider,
  DEFAULT_BASE32_ADDRESS_TEST,
  DEFAULT_HEX_ADDRESS,
  DEFAULT_PRIVATE_KEY,
  DEFAULT_TEST_NET_20_TOKEN_CONTRACT,
  DEFAULT_TEST_NET_1155_CONTRACT,
  DEFAULT_TEST_NFT_721_CONTRACT,
} from '@core/testUtils/mocks';
import { AssetType, type ConfluxUnsignedTransaction, type ConfluxUnsignedTransactionPayload, type EvmUnsignedTransaction, NetworkType } from '@core/types';
import type { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import ConfluxLegacy from '@core/WalletCore/Plugins/Transaction/chains/conflux';
import EVMLegacy from '@core/WalletCore/Plugins/Transaction/chains/evm';
import { buildTransaction as buildLegacyTransaction } from '@core/WalletCore/Plugins/Transaction/TransactionBuilder';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';

import { checksum } from 'ox/Address';
import { ChainRegistry, ConfluxChainProvider, EthereumChainProvider } from '..';
import { EndpointManager } from '../EndpointManager';

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn(),
  };
});

const actualEthers = jest.requireActual('ethers');

const { JsonRpcProvider: MockedJsonRpcProvider, Wallet: MockedWallet } = jest.requireMock('ethers');

const CONFLUX_ENDPOINT = 'https://rpc.test/cfx';
const CONFLUX_NETWORK_ID = 'net_cfx_0x1';
const CONFLUX_OPTIONS = { chainId: '0x1', netId: 1, networkId: CONFLUX_NETWORK_ID };

const ETHEREUM_ENDPOINT = 'https://rpc.test/eth';
const ETHEREUM_NETWORK_ID = 'net_eth_1';
const ETHEREUM_OPTIONS = { chainId: '1', networkId: ETHEREUM_NETWORK_ID };

const createEndpointManager = () => {
  const manager = new EndpointManager();
  manager.setEndpoint(CONFLUX_NETWORK_ID, CONFLUX_ENDPOINT);
  manager.setEndpoint(ETHEREUM_NETWORK_ID, ETHEREUM_ENDPOINT);
  return manager;
};

const ETH_ADDRESS = checksum(DEFAULT_HEX_ADDRESS);
const ETH_CONTRACT = '0x2222222222222222222222222222222222222222';
const NFT_CONTRACT = '0x3333333333333333333333333333333333333333';
const ERC1155_CONTRACT = '0x4444444444444444444444444444444444444444';

type BuildCase = {
  title: string;
  asset: AssetInfo;
  amount: string;
  assetDecimals: number;
  recipient: string;
  params: Partial<{
    contractAddress: string;
    nftTokenId: string;
  }>;
};

const makeAsset = (type: AssetType, contractAddress = '', decimals?: number): AssetInfo => ({
  type,
  contractAddress,
  name: `${type} Token`,
  symbol: type,
  decimals: decimals ?? (type === AssetType.ERC721 || type === AssetType.ERC1155 ? 0 : 18),
  balance: '0',
});

type MinimalTxFields = {
  to?: unknown;
  from?: unknown;
  value?: unknown;
  data?: unknown;
  chainId?: unknown;
};

const normalizeLegacyTx = <T extends MinimalTxFields>(tx: T): MinimalTxFields => ({
  to: tx.to,
  from: tx.from,
  value: tx.value,
  data: tx.data,
  chainId: tx.chainId,
});

const toLegacyTx = (payload: ConfluxUnsignedTransactionPayload): ITxEvm => ({
  from: payload.from,
  to: payload.to ?? payload.from,
  value: payload.value,
  data: payload.data,
  chainId: payload.chainId,
  gasLimit: payload.gasLimit,
  gasPrice: payload.gasPrice,
  storageLimit: payload.storageLimit,
  nonce: payload.nonce,
});

describe('chain compatibility', () => {
  let confluxMocks: ReturnType<typeof createMockConfluxRpc>;
  let ethersMocks: ReturnType<typeof createMockEthersProvider>;
  let walletSignStub: jest.Mock;
  let walletSignMessageStub: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRpcRequest.mockReset();
    mockCheckIsContractAddress.mockReset();

    mockRpcRequest.mockImplementation((method: string) => {
      switch (method) {
        case 'cfx_estimateGasAndCollateral':
          return { gasLimit: '0x5208', storageCollateralized: '0x0' };
        case 'cfx_gasPrice':
        case 'eth_gasPrice':
          return '0x1';
        case 'cfx_getBlockByEpochNumber':
        case 'eth_getBlockByNumber':
          return { baseFeePerGas: '0x1' };
        case 'eth_estimateGas':
          return '0x5208';
        default:
          return null;
      }
    });
    mockCheckIsContractAddress.mockResolvedValue(false);
    confluxMocks = createMockConfluxRpc();
    ethersMocks = createMockEthersProvider();

    MockedJsonRpcProvider.mockImplementation(() => ethersMocks.provider);

    walletSignStub = jest.fn();
    walletSignMessageStub = jest.fn();

    MockedWallet.mockImplementation((privateKey: string, provider?: unknown) => {
      const actualWallet = new actualEthers.Wallet(privateKey, provider as any);
      return {
        async signTransaction(payload: unknown) {
          walletSignStub(payload);
          return actualWallet.signTransaction(payload as any);
        },
        async signMessage(message: string | Uint8Array) {
          walletSignMessageStub(message);
          return actualWallet.signMessage(message);
        },
      };
    });
  });

  describe('transaction building', () => {
    const confluxCases: BuildCase[] = [
      {
        title: 'Conflux native transfer',
        asset: makeAsset(AssetType.Native, '', 18),
        amount: '1',
        assetDecimals: 18,
        recipient: DEFAULT_BASE32_ADDRESS_TEST,
        params: {},
      },
      (() => {
        const asset = makeAsset(AssetType.ERC20, DEFAULT_TEST_NET_20_TOKEN_CONTRACT, 6);
        return {
          title: 'Conflux ERC20 transfer',
          asset,
          amount: '25',
          assetDecimals: asset.decimals ?? 18,
          recipient: DEFAULT_BASE32_ADDRESS_TEST,
          params: {},
        } as BuildCase;
      })(),
      (() => {
        const asset = makeAsset(AssetType.ERC721, DEFAULT_TEST_NFT_721_CONTRACT, 0);
        return {
          title: 'Conflux ERC721 transfer',
          asset,
          amount: '1',
          assetDecimals: asset.decimals ?? 0,
          recipient: DEFAULT_BASE32_ADDRESS_TEST,
          params: { nftTokenId: '123' },
        } as BuildCase;
      })(),
      (() => {
        const asset = makeAsset(AssetType.ERC1155, DEFAULT_TEST_NET_1155_CONTRACT, 0);
        return {
          title: 'Conflux ERC1155 transfer',
          asset,
          amount: '5',
          assetDecimals: asset.decimals ?? 0,
          recipient: DEFAULT_BASE32_ADDRESS_TEST,
          params: { nftTokenId: '456' },
        } as BuildCase;
      })(),
    ];

    const evmCases: BuildCase[] = [
      {
        title: 'Ethereum native transfer',
        asset: makeAsset(AssetType.Native, '', 18),
        amount: '1',
        assetDecimals: 18,
        recipient: ETH_ADDRESS,
        params: {},
      },
      {
        title: 'Ethereum ERC20 transfer',
        asset: makeAsset(AssetType.ERC20, ETH_CONTRACT, 18),
        amount: '42',
        assetDecimals: 18,
        recipient: ETH_ADDRESS,
        params: {},
      },
      {
        title: 'Ethereum ERC721 transfer',
        asset: makeAsset(AssetType.ERC721, NFT_CONTRACT, 0),
        amount: '1',
        assetDecimals: 0,
        recipient: ETH_ADDRESS,
        params: { nftTokenId: '777' },
      },
      {
        title: 'Ethereum ERC1155 transfer',
        asset: makeAsset(AssetType.ERC1155, ERC1155_CONTRACT, 0),
        amount: '9',
        assetDecimals: 0,
        recipient: ETH_ADDRESS,
        params: { nftTokenId: '888' },
      },
    ];

    it.each(confluxCases)('%s matches legacy builder', async ({ asset, amount, assetDecimals, recipient, params }) => {
      const endpointManager = createEndpointManager();
      const provider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
      jest.spyOn(provider.rpc, 'request').mockImplementation(confluxMocks.request);
      const from = DEFAULT_BASE32_ADDRESS_TEST;

      const legacyNetwork = { chainId: CONFLUX_OPTIONS.chainId, networkType: NetworkType.Conflux } as unknown as Network;
      const legacyTx = buildLegacyTransaction({
        asset,
        amount,
        recipientAddress: recipient,
        currentAddressValue: from,
        currentNetwork: legacyNetwork,
        nftTokenId: params.nftTokenId,
      });

      const unsigned = (await provider.buildTransaction({
        from,
        to: recipient,
        chainId: CONFLUX_OPTIONS.chainId,
        amount,
        assetType: asset.type,
        assetDecimals,
        contractAddress: params.contractAddress ?? asset.contractAddress,
        nftTokenId: params.nftTokenId,
      })) as ConfluxUnsignedTransaction;

      expect(normalizeLegacyTx(legacyTx)).toEqual(normalizeLegacyTx(unsigned.payload));
    });

    it.each(evmCases)('%s matches legacy builder', async ({ asset, amount, assetDecimals, recipient, params }) => {
      const endpointManager = createEndpointManager();
      const provider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });
      const from = checksum(DEFAULT_HEX_ADDRESS);

      const legacyNetwork = { chainId: ETHEREUM_OPTIONS.chainId, networkType: NetworkType.Ethereum } as unknown as Network;
      const legacyTx = buildLegacyTransaction({
        asset,
        amount,
        recipientAddress: recipient,
        currentAddressValue: from,
        currentNetwork: legacyNetwork,
        nftTokenId: params.nftTokenId,
      });

      const unsigned = (await provider.buildTransaction({
        from,
        to: recipient,
        chainId: ETHEREUM_OPTIONS.chainId,
        amount,
        assetType: asset.type,
        assetDecimals,
        contractAddress: params.contractAddress ?? asset.contractAddress,
        nftTokenId: params.nftTokenId,
      })) as EvmUnsignedTransaction;

      expect(normalizeLegacyTx(legacyTx)).toEqual(normalizeLegacyTx(unsigned.payload));
    });
  });
  describe('signing compatibility', () => {
    it('Conflux signing matches the SDK reference bytes', async () => {
      const endpointManager = createEndpointManager();
      const provider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
      jest.spyOn(provider.rpc, 'request').mockImplementation(confluxMocks.request);
      confluxMocks.responses.cfx_getNextNonce = '0x1';
      confluxMocks.responses.cfx_epochNumber = '0x64';

      const from = DEFAULT_BASE32_ADDRESS_TEST;
      const unsigned = (await provider.buildTransaction({
        from,
        to: DEFAULT_BASE32_ADDRESS_TEST,
        chainId: CONFLUX_OPTIONS.chainId,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
        gasLimit: '0x5208',
        gasPrice: '0x1',
        storageLimit: '0x0',
      })) as ConfluxUnsignedTransaction;

      const signer = new SoftwareSigner(DEFAULT_PRIVATE_KEY);
      const signed = await provider.signTransaction(unsigned, signer);

      // Generated with js-conflux-sdk 2.5.0 for the transaction above.
      expect(signed.rawTransaction).toBe(
        '0xf86be7010182520894146b39d7d12d34ddb93640ba8487c1cc143bb37d880de0b6b3a76400008064018080a0d03b0c3ccc9deff096ea895b2c19d7e1a935498b02504e0becfb58b9c854f257a00642d9c67fc5d6d36cea54d70130a2c1f5bc3cca810ba99a9bb0df247a0cc337',
      );
    });

    it('Ethereum signing aligns with legacy implementation', async () => {
      const endpointManager = createEndpointManager();
      const provider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });

      ethersMocks.provider.getTransactionCount.mockResolvedValueOnce(5);

      const unsigned = (await provider.buildTransaction({
        from: ETH_ADDRESS,
        to: ETH_ADDRESS,
        chainId: ETHEREUM_OPTIONS.chainId,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
        gasLimit: '0x5208',
        gasPrice: '0x1',
      })) as EvmUnsignedTransaction;

      const signer = new SoftwareSigner(DEFAULT_PRIVATE_KEY);
      const signed = await provider.signTransaction(unsigned, signer);

      const legacyRaw = await EVMLegacy.signTransaction({
        privateKey: DEFAULT_PRIVATE_KEY,
        tx: toLegacyTx(unsigned.payload),
      });

      const parsedNew = actualEthers.Transaction.from(signed.rawTransaction);
      const parsedLegacy = actualEthers.Transaction.from(legacyRaw);

      expect(parsedNew.to).toBe(parsedLegacy.to);
      expect(parsedNew.from?.toLowerCase()).toBe(parsedLegacy.from?.toLowerCase());
      expect(parsedNew.value).toEqual(parsedLegacy.value);
      expect(parsedNew.data).toBe(parsedLegacy.data);
      expect(parsedNew.gasLimit).toEqual(parsedLegacy.gasLimit);
      expect(parsedNew.chainId).toEqual(parsedLegacy.chainId);
    });
  });

  describe('fee estimate stubs remain consistent', () => {
    it('Conflux fee estimation calls match legacy pipeline', async () => {
      const endpointManager = createEndpointManager();
      const provider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
      jest.spyOn(provider.rpc, 'request').mockImplementation(confluxMocks.request);
      const unsigned = (await provider.buildTransaction({
        from: DEFAULT_BASE32_ADDRESS_TEST,
        to: DEFAULT_BASE32_ADDRESS_TEST,
        chainId: CONFLUX_OPTIONS.chainId,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
      })) as ConfluxUnsignedTransaction;

      const newEstimate = await provider.estimateFee(unsigned);
      expect(newEstimate.gasLimit).toBe('0x5208');

      const legacyEstimate = await ConfluxLegacy.estimate({
        tx: {
          from: unsigned.payload.from,
          to: unsigned.payload.to,
          value: unsigned.payload.value,
        },
        endpoint: CONFLUX_ENDPOINT,
      });

      expect(legacyEstimate.gasLimit).toBe(newEstimate.gasLimit);
      expect(confluxMocks.request).toHaveBeenCalledWith('cfx_estimateGasAndCollateral', [
        expect.objectContaining({ from: unsigned.payload.from, to: unsigned.payload.to }),
        'latest_state',
      ]);
    });

    it('Ethereum fee estimation calls match legacy pipeline', async () => {
      const endpointManager = createEndpointManager();
      const provider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });
      const unsigned = (await provider.buildTransaction({
        from: ETH_ADDRESS,
        to: ETH_ADDRESS,
        chainId: ETHEREUM_OPTIONS.chainId,
        amount: '1',
        assetType: AssetType.Native,
        assetDecimals: 18,
      })) as EvmUnsignedTransaction;

      ethersMocks.provider.estimateGas.mockResolvedValueOnce(21_000n);
      ethersMocks.provider.getFeeData.mockResolvedValueOnce({
        gasPrice: 3n,
        maxFeePerGas: 4n,
        maxPriorityFeePerGas: 1n,
      });

      const newEstimate = await provider.estimateFee(unsigned);
      expect(newEstimate.gasLimit).toBe('0x5208');

      const legacyEstimate = await EVMLegacy.estimate({
        tx: {
          from: unsigned.payload.from,
          to: unsigned.payload.to,
          value: unsigned.payload.value,
        },
        endpoint: ETHEREUM_ENDPOINT,
      });

      expect(legacyEstimate.gasLimit).toBe(newEstimate.gasLimit);
      expect(ethersMocks.provider.estimateGas).toHaveBeenCalled();
    });
  });
});
