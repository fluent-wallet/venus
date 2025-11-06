import { ChainRegistry, ConfluxChainProvider, EthereumChainProvider } from '..';
import { AssetType, NetworkType, type ConfluxUnsignedTransaction, type EvmUnsignedTransaction } from '@core/types';
import { createMockConfluxSdk, createMockEthersProvider, DEFAULT_BASE32_ADDRESS_TEST, DEFAULT_HEX_ADDRESS, DEFAULT_PRIVATE_KEY } from '@core/__tests__/mocks';
import { convertHexToBase32 } from '@core/utils/address';
import { computeAddress as computeAccountAddress, toAccountAddress } from '@core/utils/account';
import { HDNode } from '@ethersproject/hdnode';

jest.mock('js-conflux-sdk', () => {
  const actual = jest.requireActual('js-conflux-sdk');
  return {
    ...actual,
    Conflux: jest.fn(),
    PrivateKeyAccount: jest.fn(),
  };
});

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: jest.fn(),
    Wallet: jest.fn(),
  };
});

const { Conflux: MockedConflux, PrivateKeyAccount: MockedPrivateKeyAccount, PersonalMessage } = jest.requireMock('js-conflux-sdk');
const { JsonRpcProvider: MockedJsonRpcProvider, Wallet: MockedWallet } = jest.requireMock('ethers');
const actualEthers = jest.requireActual('ethers');

const CONFLUX_OPTIONS = { chainId: '0x1', endpoint: 'https://rpc.test/cfx', netId: 1 };
const ETHEREUM_OPTIONS = { chainId: '1', endpoint: 'https://rpc.test/eth' };
const ETH_PRIVATE_KEY = DEFAULT_PRIVATE_KEY;
const ETHEREUM_ADDRESS = DEFAULT_HEX_ADDRESS;
const CONFLUX_ADDRESS = DEFAULT_BASE32_ADDRESS_TEST;

describe('chain integration', () => {
  let confluxRpc: ReturnType<typeof createMockConfluxSdk>;
  let ethersProvider: ReturnType<typeof createMockEthersProvider>;
  let confluxSignTransaction: jest.Mock;
  let ethereumSignTransaction: jest.Mock;
  let ethereumSignMessage: jest.Mock;
  let lastWalletArgs: unknown[] | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    confluxRpc = createMockConfluxSdk();
    ethersProvider = createMockEthersProvider();

    MockedConflux.mockImplementation(() => ({
      cfx: confluxRpc.rpc,
      sendRawTransaction: confluxRpc.sdk.sendRawTransaction,
    }));

    confluxSignTransaction = jest.fn().mockResolvedValue({
      serialize: () => '0xconflux-raw',
      hash: '0xconflux-hash',
    });

    MockedPrivateKeyAccount.mockImplementation(() => ({
      signTransaction: confluxSignTransaction,
    }));

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
    const registry = new ChainRegistry();
    const conflux = new ConfluxChainProvider(CONFLUX_OPTIONS);
    const ethereum = new EthereumChainProvider(ETHEREUM_OPTIONS);

    registry.register(conflux).register(ethereum);

    expect(registry.size).toBe(2);
    expect(registry.get(CONFLUX_OPTIONS.chainId, NetworkType.Conflux)).toBe(conflux);
    expect(registry.get(ETHEREUM_OPTIONS.chainId, NetworkType.Ethereum)).toBe(ethereum);
    expect(registry.getByType(NetworkType.Conflux)).toHaveLength(1);
    expect(registry.has('0x1')).toBe(true);
  });

  it('runs full Conflux flow: build → estimate → sign → broadcast', async () => {
    const provider = new ConfluxChainProvider(CONFLUX_OPTIONS);

    confluxRpc.rpc.getNextNonce.mockResolvedValueOnce(5n);
    confluxRpc.rpc.getEpochNumber.mockResolvedValueOnce(100n);
    confluxRpc.rpc.estimateGasAndCollateral.mockResolvedValueOnce({
      gasUsed: 0x5208n,
      gasLimit: 0x5208n,
      storageCollateralized: 0n,
    });
    confluxRpc.rpc.getGasPrice.mockResolvedValueOnce(1n);

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

    const fee = await provider.estimateFee(unsigned);
    expect(fee.gasLimit).toBe('0x5208');
    expect(confluxRpc.rpc.estimateGasAndCollateral).toHaveBeenCalledWith({
      from: CONFLUX_ADDRESS,
      to: CONFLUX_ADDRESS,
      data: '0x',
      value: '0xde0b6b3a7640000',
    });

    const signed = await provider.signTransaction(unsigned, { privateKey: ETH_PRIVATE_KEY });
    expect(MockedPrivateKeyAccount).toHaveBeenCalledWith(ETH_PRIVATE_KEY, CONFLUX_OPTIONS.netId);
    expect(confluxSignTransaction).toHaveBeenCalled();

    confluxRpc.sdk.sendRawTransaction.mockResolvedValueOnce('0xconflux-hash');
    const hash = await provider.broadcastTransaction(signed);
    expect(hash).toBe('0xconflux-hash');
  });

  it('runs full EVM flow: build → estimate → sign → broadcast', async () => {
    const provider = new EthereumChainProvider(ETHEREUM_OPTIONS);

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

    const signed = await provider.signTransaction(unsigned, { privateKey: ETH_PRIVATE_KEY });
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
    const mnemonic = 'test test test test test test test test test test test junk';
    const confluxNode = HDNode.fromMnemonic(mnemonic).derivePath("m/44'/503'/0'/0/0");
    const ethereumNode = HDNode.fromMnemonic(mnemonic).derivePath("m/44'/60'/0'/0/0");

    const confluxProvider = new ConfluxChainProvider(CONFLUX_OPTIONS);
    const derivedBase32 = confluxProvider.deriveAddress(confluxNode.publicKey as `0x${string}`);
    const expectedBase32 = convertHexToBase32(toAccountAddress(computeAccountAddress(confluxNode.publicKey as `0x${string}`)), CONFLUX_OPTIONS.netId);
    expect(derivedBase32).toBe(expectedBase32);

    const ethereumProvider = new EthereumChainProvider(ETHEREUM_OPTIONS);
    const derivedHex = ethereumProvider.deriveAddress(ethereumNode.publicKey);
    expect(derivedHex).toBe(actualEthers.getAddress(ethereumNode.address));
  });

  it('signs and verifies messages across chains', async () => {
    const message = 'Venus wallet integration';
    const confluxProvider = new ConfluxChainProvider(CONFLUX_OPTIONS);

    const confluxSignature = await confluxProvider.signMessage(message, { privateKey: ETH_PRIVATE_KEY });
    expect(confluxProvider.verifyMessage(message, confluxSignature, CONFLUX_ADDRESS)).toBe(true);

    const ethereumProvider = new EthereumChainProvider(ETHEREUM_OPTIONS);
    const actualWallet = new actualEthers.Wallet(ETH_PRIVATE_KEY);
    const expectedSignature = await actualWallet.signMessage(message);
    ethereumSignMessage.mockResolvedValueOnce(expectedSignature);

    const ethereumSignature = await ethereumProvider.signMessage(message, { privateKey: ETH_PRIVATE_KEY });
    expect(ethereumSignature).toBe(expectedSignature);
    expect(ethereumProvider.verifyMessage(message, ethereumSignature, actualWallet.address)).toBe(true);
  });
});
