import 'reflect-metadata';
import type { HardwareSignResult, SigningPayload } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import { Wallet as EthersWallet, hashMessage, keccak256, Signature, SigningKey, Transaction, TypedDataEncoder } from 'ethers';
import type { Hex } from 'ox/Hex';
import type { Wallet as NativeWallet, PubkeyRecord } from 'react-native-bsim';
import { BSIM_ACCOUNT_LIMIT, BSIM_ERROR_CANCEL } from './constants';
import { BSIMHardwareError } from './errors';
import { BSIMHardwareWallet } from './index';

const TEST_PRIVATE_KEY = '0x59c6995e998f97a5a0044976f7a5e7f9c409d57d5e1bf5dc8ab8c41c4b0dae31';
const TEST_SIGNING_KEY = new SigningKey(TEST_PRIVATE_KEY);
const TEST_PUBLIC_KEY = TEST_SIGNING_KEY.publicKey;
const TEST_ADDRESS = new EthersWallet(TEST_PRIVATE_KEY).address;
const EVM_COIN_TYPE = 60;

type MockWallet = jest.Mocked<NativeWallet>;

const buildPubkeyRecord = (index = 1): PubkeyRecord => ({
  coinType: EVM_COIN_TYPE,
  index,
  alg: 1,
  key: TEST_PUBLIC_KEY.slice(2),
});

const createStubWallet = (overrides: Partial<MockWallet> = {}): MockWallet => {
  const base: Partial<MockWallet> = {
    runSession: jest.fn(),
    verifyBpin: jest.fn().mockResolvedValue(undefined),
    exportPubkeys: jest.fn().mockResolvedValue([buildPubkeyRecord()]),
    signMessage: jest.fn().mockImplementation(async ({ hash }: { hash: Hex }) => {
      const signature = TEST_SIGNING_KEY.sign(hash);
      return {
        r: signature.r.slice(2).toUpperCase(),
        s: signature.s.slice(2).toUpperCase(),
      };
    }),
    deriveKey: jest.fn().mockResolvedValue(undefined),
    updateBpin: jest.fn().mockResolvedValue('ok'),
    getVersion: jest.fn().mockResolvedValue('0001'),
    getIccid: jest.fn().mockResolvedValue('iccid'),
    backupSeed: jest.fn().mockResolvedValue('0x1234'),
    restoreSeed: jest.fn().mockResolvedValue('ok'),
  };
  return { ...base, ...overrides } as MockWallet;
};

const createAdapter = (walletOverrides: Partial<MockWallet> = {}) => {
  const wallet = createStubWallet(walletOverrides);
  const factory = jest.fn(() => wallet);
  const adapter = new BSIMHardwareWallet({ walletFactory: factory });
  return { adapter, wallet };
};

const buildTransactionPayload = (): Extract<SigningPayload, { payloadKind: 'transaction' }> => ({
  payloadKind: 'transaction',
  chainType: NetworkType.Ethereum,
  unsignedTx: {
    from: TEST_ADDRESS,
    to: TEST_ADDRESS,
    chainId: '0x1',
    value: '0x0',
    data: '0x',
    gasLimit: '0x5208',
    gasPrice: '0x3b9aca00',
    nonce: 0,
  },
});

const connectAndResolveAccount = async (adapter: BSIMHardwareWallet) => {
  await adapter.connect();
  const accounts = await adapter.listAccounts(NetworkType.Ethereum);
  const account = accounts[0];
  if (!account) throw new Error('Missing test account');
  return account;
};

const signWithAdapter = async (adapter: BSIMHardwareWallet, payload: SigningPayload): Promise<HardwareSignResult> => {
  const account = await connectAndResolveAccount(adapter);
  return adapter.sign({
    derivationPath: account.derivationPath ?? "m/44'/503'/0'/0/0",
    chainType: NetworkType.Ethereum,
    payload,
  });
};

describe('BSIMHardwareWallet', () => {
  it('connects and enumerates hardware accounts', async () => {
    const { adapter, wallet } = createAdapter();
    await adapter.connect();
    expect(await adapter.isConnected()).toBe(true);

    const accounts = await adapter.listAccounts(NetworkType.Ethereum);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].address).toEqual(TEST_ADDRESS);
    expect(wallet.exportPubkeys).toHaveBeenCalledTimes(1);
  });

  it('throws when using unsupported chain', async () => {
    const { adapter } = createAdapter();
    await adapter.connect();
    await expect(adapter.listAccounts(NetworkType.Conflux)).rejects.toThrow('BSIM adapter only supports Ethereum-compatible chains');
  });

  it('prevents access before calling connect', async () => {
    const { adapter } = createAdapter();
    await expect(adapter.listAccounts(NetworkType.Ethereum)).rejects.toThrow('BSIM wallet has not been connected.');
  });

  it('signs Ethereum transactions identical to software wallet', async () => {
    const { adapter } = createAdapter();
    const payload = buildTransactionPayload();
    const hardwareResult = await signWithAdapter(adapter, payload);
    assertRawTransaction(hardwareResult);
    const unsignedTx = Transaction.from({ ...payload.unsignedTx, from: undefined });
    const softwareSignature = TEST_SIGNING_KEY.sign(unsignedTx.unsignedHash);
    unsignedTx.signature = Signature.from(softwareSignature);
    const expectedRaw = unsignedTx.serialized;
    const expectedHash = keccak256(expectedRaw);

    expect(hardwareResult.rawTransaction).toEqual(expectedRaw);
    expect(hardwareResult.hash).toEqual(expectedHash);
  });

  it('signs personal messages compatible with ethers signatures', async () => {
    const { adapter } = createAdapter();
    const message = 'Hello BSIM';
    const result = await signWithAdapter(adapter, {
      payloadKind: 'message',
      messageKind: 'personal',
      chainType: NetworkType.Ethereum,
      message,
    });
    assertBasicSignature(result);
    const serialized = Signature.from({ r: result.r, s: result.s, v: result.v }).serialized;
    const expected = await new EthersWallet(TEST_PRIVATE_KEY).signMessage(message);
    expect(serialized).toEqual(expected);
  });

  it('signs typed data using EIP-712 flow', async () => {
    const { adapter } = createAdapter();
    const domain = { name: 'Mail', version: '1', chainId: 1, verifyingContract: TEST_ADDRESS };
    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Mail: [{ name: 'contents', type: 'string' }],
    };
    const message = { contents: 'Hello World' };
    const digest = TypedDataEncoder.hash(domain, { Mail: types.Mail }, message);
    const result = await signWithAdapter(adapter, {
      payloadKind: 'message',
      messageKind: 'typedData',
      chainType: NetworkType.Ethereum,
      domain,
      types,
      message,
    });
    assertTypedSignature(result);
    const expected = Signature.from(TEST_SIGNING_KEY.sign(digest)).serialized;
    expect(result.signature).toEqual(expected);
  });

  it('normalizes hardware indexes while preserving derivation paths', async () => {
    const exportPubkeys = jest.fn().mockResolvedValue([buildPubkeyRecord(0), buildPubkeyRecord(2), buildPubkeyRecord(5)]);
    const { adapter } = createAdapter({ exportPubkeys });
    await adapter.connect();
    const accounts = await adapter.listAccounts(NetworkType.Ethereum);
    expect(accounts).toHaveLength(2);
    expect(accounts.map((account) => account.index)).toEqual([0, 1]);
    expect(accounts[0]?.derivationPath?.endsWith('/2')).toBe(true);
    expect(accounts[1]?.derivationPath?.endsWith('/5')).toBe(true);
  });

  it('uses real hardware slot index when signing', async () => {
    const targetIndex = 7;
    const exportPubkeys = jest.fn().mockResolvedValue([buildPubkeyRecord(targetIndex)]);
    const signMessage = jest.fn().mockImplementation(async ({ index, hash }: { index: number; hash: Hex }) => {
      const signature = TEST_SIGNING_KEY.sign(hash);
      expect(index).toBe(targetIndex);
      return { r: signature.r.slice(2).toUpperCase(), s: signature.s.slice(2).toUpperCase() };
    });
    const { adapter, wallet } = createAdapter({ exportPubkeys, signMessage });
    await signWithAdapter(adapter, buildTransactionPayload());
    expect(wallet.signMessage).toHaveBeenCalled();
  });

  it('aborts signing when signal is cancelled', async () => {
    const signMessage = jest.fn<ReturnType<MockWallet['signMessage']>, Parameters<MockWallet['signMessage']>>(() => new Promise(() => {}));
    const { adapter } = createAdapter({ signMessage });
    await adapter.connect();
    const accounts = await adapter.listAccounts(NetworkType.Ethereum);
    const account = accounts[0];
    if (!account) throw new Error('Missing account');
    const controller = new AbortController();
    const signing = adapter.sign({
      derivationPath: account.derivationPath ?? "m/44'/60'/0'/0/1",
      chainType: NetworkType.Ethereum,
      payload: buildTransactionPayload(),
      signal: controller.signal,
    });
    controller.abort();
    await expect(signing).rejects.toMatchObject({ code: BSIM_ERROR_CANCEL });
  });

  it('propagates cancel errors without retrying signMessage', async () => {
    const cancelError = new BSIMHardwareError(BSIM_ERROR_CANCEL, 'User cancelled');
    const signMessage = jest.fn().mockRejectedValue(cancelError);
    const { adapter, wallet } = createAdapter({ signMessage });
    await expect(signWithAdapter(adapter, buildTransactionPayload())).rejects.toMatchObject({ code: BSIM_ERROR_CANCEL });
    expect(wallet.signMessage).toHaveBeenCalledTimes(1);
  });

  it('throws when deriving accounts beyond the hardware limit', async () => {
    const { adapter } = createAdapter();
    await adapter.connect();
    await expect(adapter.deriveAccount(BSIM_ACCOUNT_LIMIT, NetworkType.Ethereum)).rejects.toMatchObject({ code: 'ACCOUNT_LIMIT' });
  });
});

function assertRawTransaction(result: HardwareSignResult): asserts result is Extract<HardwareSignResult, { resultType: 'rawTransaction' }> {
  if (result.resultType !== 'rawTransaction') {
    throw new Error(`Expected rawTransaction result, received ${result.resultType}`);
  }
}

function assertBasicSignature(result: HardwareSignResult): asserts result is Extract<HardwareSignResult, { resultType: 'signature' }> {
  if (result.resultType !== 'signature') {
    throw new Error(`Expected signature result, received ${result.resultType}`);
  }
}

function assertTypedSignature(result: HardwareSignResult): asserts result is Extract<HardwareSignResult, { resultType: 'typedSignature' }> {
  if (result.resultType !== 'typedSignature') {
    throw new Error(`Expected typedSignature result, received ${result.resultType}`);
  }
}
