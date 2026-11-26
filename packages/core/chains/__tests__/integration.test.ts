import 'reflect-metadata';
import { SoftwareSigner } from '@core/signers';
import { createMockConfluxRpc, createMockEthersProvider, DEFAULT_BASE32_ADDRESS_TEST, DEFAULT_HEX_ADDRESS, DEFAULT_PRIVATE_KEY } from '@core/testUtils/mocks';
import { AssetType, type ConfluxUnsignedTransaction, type EvmUnsignedTransaction, NetworkType } from '@core/types';
import { computeAddress as computeAccountAddress, toAccountAddress } from '@core/utils/account';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { hexAddressToBase32 } from 'cive/utils';
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

const { JsonRpcProvider: MockedJsonRpcProvider, Wallet: MockedWallet } = jest.requireMock('ethers');
const actualEthers = jest.requireActual('ethers');

const CONFLUX_ENDPOINT = 'https://rpc.test/cfx';
const CONFLUX_NETWORK_ID = 'net_cfx_0x1';

const ETHEREUM_ENDPOINT = 'https://rpc.test/eth';
const ETHEREUM_NETWORK_ID = 'net_eth_1';

const CONFLUX_OPTIONS = { chainId: '0x1', netId: 1, networkId: CONFLUX_NETWORK_ID };
const ETHEREUM_OPTIONS = { chainId: '1', networkId: ETHEREUM_NETWORK_ID };

const ETH_PRIVATE_KEY = DEFAULT_PRIVATE_KEY;
const ETHEREUM_ADDRESS = DEFAULT_HEX_ADDRESS;
const CONFLUX_ADDRESS = DEFAULT_BASE32_ADDRESS_TEST;

const derivePublicKey = (mnemonic: string, path: string) => {
  const node = HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(path);
  if (!node.privateKey) {
    throw new Error(`Expected derived node at ${path} to contain a private key.`);
  }
  return actualEthers.SigningKey.computePublicKey(actualEthers.hexlify(node.privateKey), false);
};

describe('chain integration', () => {
  const createEndpointManager = () => {
    const manager = new EndpointManager();
    manager.setEndpoint(CONFLUX_NETWORK_ID, CONFLUX_ENDPOINT);
    manager.setEndpoint(ETHEREUM_NETWORK_ID, ETHEREUM_ENDPOINT);
    return manager;
  };
  let confluxRpc: ReturnType<typeof createMockConfluxRpc>;
  let ethersProvider: ReturnType<typeof createMockEthersProvider>;
  let ethereumSignTransaction: jest.Mock;
  let ethereumSignMessage: jest.Mock;
  let lastWalletArgs: unknown[] | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    confluxRpc = createMockConfluxRpc();
    ethersProvider = createMockEthersProvider();

    MockedJsonRpcProvider.mockImplementation(() => ethersProvider.provider);

    ethereumSignTransaction = jest.fn().mockResolvedValue('0xdeadbeef');
    ethereumSignMessage = jest.fn();
    lastWalletArgs = null;

    MockedWallet.mockImplementation((privateKey: string, provider: unknown) => {
      lastWalletArgs = [privateKey, provider];
      return {
        signTransaction: ethereumSignTransaction,
        signMessage: ethereumSignMessage,
      };
    });
  });
  it('registers providers and retrieves them via ChainRegistry', () => {
    const endpointManager = createEndpointManager();

    const registry = new ChainRegistry();
    const conflux = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
    const ethereum = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });

    registry.register(conflux).register(ethereum);

    expect(registry.size).toBe(2);
    expect(registry.get(CONFLUX_OPTIONS.chainId, NetworkType.Conflux)).toBe(conflux);
    expect(registry.get(ETHEREUM_OPTIONS.chainId, NetworkType.Ethereum)).toBe(ethereum);
    expect(registry.getByType(NetworkType.Conflux)).toHaveLength(1);
    expect(registry.has('0x1')).toBe(true);
  });
  it('runs full Conflux flow: build → estimate → sign → broadcast', async () => {
    const endpointManager = createEndpointManager();
    const provider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
    jest.spyOn(provider.rpc, 'request').mockImplementation(confluxRpc.request);

    confluxRpc.responses.cfx_getNextNonce = '0x5';
    confluxRpc.responses.cfx_epochNumber = '0x64';

    const unsigned = (await provider.buildTransaction({
      from: CONFLUX_ADDRESS,
      to: CONFLUX_ADDRESS,
      chainId: CONFLUX_OPTIONS.chainId,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
    })) as ConfluxUnsignedTransaction;

    expect(unsigned.payload.nonce).toBe(5);
    expect(unsigned.payload.epochHeight).toBe(100);

    const prepared = await provider.prepareUnsignedTransaction(unsigned);
    expect(prepared.payload.gasLimit).toBe('0x5208');
    expect(confluxRpc.request).toHaveBeenCalledWith('cfx_estimateGasAndCollateral', [
      {
        from: CONFLUX_ADDRESS,
        to: CONFLUX_ADDRESS,
        data: '0x',
        value: '0xde0b6b3a7640000',
      },
      'latest_state',
    ]);

    const signer = new SoftwareSigner(ETH_PRIVATE_KEY);
    const signed = await provider.signTransaction(prepared, signer);
    expect(signed.rawTransaction).toMatch(/^0x[0-9a-f]+$/);
    expect(signed.hash).toMatch(/^0x[0-9a-f]{64}$/);

    confluxRpc.responses.cfx_sendRawTransaction = signed.hash;
    const hash = await provider.broadcastTransaction(signed);
    expect(hash).toBe(signed.hash);
    expect(confluxRpc.request).toHaveBeenCalledWith('cfx_sendRawTransaction', [signed.rawTransaction]);
  });

  it('runs full EVM flow: build → estimate → sign → broadcast', async () => {
    const endpointManager = createEndpointManager();
    const provider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });

    ethersProvider.provider.getTransactionCount.mockResolvedValueOnce(7);
    ethersProvider.provider.estimateGas.mockResolvedValueOnce(21_000n);
    ethersProvider.provider.getFeeData.mockResolvedValueOnce({
      gasPrice: 3n,
      maxFeePerGas: 4n,
      maxPriorityFeePerGas: 1n,
    });
    ethersProvider.provider.broadcastTransaction.mockResolvedValueOnce({ hash: '0xevm-hash' });

    const unsigned = (await provider.buildTransaction({
      from: ETHEREUM_ADDRESS,
      to: ETHEREUM_ADDRESS,
      chainId: ETHEREUM_OPTIONS.chainId,
      amount: '1',
      assetType: AssetType.Native,
      assetDecimals: 18,
      maxFeePerGas: '0x4',
      maxPriorityFeePerGas: '0x1',
    })) as EvmUnsignedTransaction;

    expect(unsigned.payload.nonce).toBe(7);
    expect(unsigned.payload.type).toBe(2);

    const fee = await provider.estimateFee(unsigned);
    expect(fee.maxFeePerGas).toBe('0x4');
    expect(ethersProvider.provider.estimateGas).toHaveBeenCalledWith(expect.objectContaining({ from: ETHEREUM_ADDRESS }));

    const signer = new SoftwareSigner(ETH_PRIVATE_KEY);
    const signed = await provider.signTransaction(unsigned, signer);
    expect(lastWalletArgs?.[0]).toBe(ETH_PRIVATE_KEY);
    expect(lastWalletArgs?.[1]).toBe(ethersProvider.provider);
    expect(ethereumSignTransaction).toHaveBeenCalledWith(unsigned.payload);

    const hash = await provider.broadcastTransaction({
      chainType: NetworkType.Ethereum,
      rawTransaction: signed.rawTransaction,
      hash: signed.hash,
    });

    expect(hash).toBe('0xevm-hash');
  });

  it('derives addresses consistent with HD key derivation', async () => {
    const endpointManager = createEndpointManager();

    const mnemonic = 'test test test test test test test test test test test junk';
    const confluxPublicKey = derivePublicKey(mnemonic, "m/44'/503'/0'/0/0");
    const ethereumPublicKey = derivePublicKey(mnemonic, "m/44'/60'/0'/0/0");

    const confluxProvider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
    const derivedBase32 = confluxProvider.deriveAddress(confluxPublicKey as `0x${string}`);
    const expectedBase32 = hexAddressToBase32({
      hexAddress: toAccountAddress(computeAccountAddress(confluxPublicKey as `0x${string}`)) as `0x${string}`,
      networkId: CONFLUX_OPTIONS.netId,
    });
    expect(derivedBase32).toBe(expectedBase32);

    const ethereumProvider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });
    const derivedHex = ethereumProvider.deriveAddress(ethereumPublicKey);
    expect(derivedHex).toBe(actualEthers.getAddress(actualEthers.computeAddress(ethereumPublicKey)));
  });

  it('signs and verifies messages across chains', async () => {
    const message = 'Venus wallet integration';
    const endpointManager = createEndpointManager();

    const confluxProvider = new ConfluxChainProvider({ ...CONFLUX_OPTIONS, endpointManager });
    const confluxSigner = new SoftwareSigner(ETH_PRIVATE_KEY);
    const confluxSignature = await confluxProvider.signMessage(message, confluxSigner);
    await expect(confluxProvider.verifyMessage(message, confluxSignature, CONFLUX_ADDRESS)).resolves.toBe(true);
    const ethereumProvider = new EthereumChainProvider({ ...ETHEREUM_OPTIONS, endpointManager });
    const actualWallet = new actualEthers.Wallet(ETH_PRIVATE_KEY);
    const expectedSignature = await actualWallet.signMessage(message);
    ethereumSignMessage.mockResolvedValueOnce(expectedSignature);

    const ethereumSigner = new SoftwareSigner(ETH_PRIVATE_KEY);
    const ethereumSignature = await ethereumProvider.signMessage(message, ethereumSigner);
    expect(ethereumSignature).toBe(expectedSignature);
    await expect(ethereumProvider.verifyMessage(message, ethereumSignature, actualWallet.address)).resolves.toBe(true);
  });
});
