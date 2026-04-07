import 'reflect-metadata';
import type { Database } from '@core/database';
import { VaultType } from '@core/database/models/Vault/VaultType';
import { CORE_IDENTIFIERS } from '@core/di';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import type { AuthService } from '@core/modules/auth';
import { AUTH_REASON } from '@core/modules/auth/reasons';
import { type CoreEventMap, InMemoryEventBus } from '@core/modules/eventBus';
import { VaultService } from '@core/services/vault';
import { SoftwareSigner } from '@core/signers';
import { createTestAccount, seedNetwork } from '@core/testUtils/fixtures';
import { mockDatabase } from '@core/testUtils/mocks';
import type { HardwareWalletCapabilities, IHardwareWallet, SigningContext } from '@core/types';
import type { HardwareAccount } from '@core/types/signer';
import { NetworkType } from '@core/utils/consts';
import { Container } from 'inversify';
import { SigningService } from './SigningService';

type VaultServiceMock = Pick<VaultService, 'getPrivateKey'>;
type AuthServiceMock = Pick<AuthService, 'getPassword'>;

const createHardwareAdapter = (sign: IHardwareWallet['sign']): IHardwareWallet => ({
  id: 'stub-bsim',
  type: HARDWARE_WALLET_TYPES.BSIM,
  connect: jest.fn(async () => undefined),
  disconnect: jest.fn(async () => undefined),
  isConnected: jest.fn(async () => true),
  listAccounts: jest.fn(async (): Promise<HardwareAccount[]> => []),
  deriveAccount: jest.fn(
    async (): Promise<HardwareAccount> => ({
      index: 0,
      address: '0x19D6c0CE28d68B0e94C97Dde714a260672f317cF',
      chainType: NetworkType.Ethereum,
      derivationPath: "m/44'/60'/0'/0/0",
    }),
  ),
  deriveAddress: jest.fn(async () => '0x19D6c0CE28d68B0e94C97Dde714a260672f317cF'),
  sign: jest.fn(sign),
  getCapabilities: jest.fn((): HardwareWalletCapabilities => ({ type: 'bsim' })),
});

describe('SigningService', () => {
  let container: Container;
  let database: Database;
  let vaultServiceMock: jest.Mocked<VaultServiceMock>;
  let hardwareRegistry: HardwareWalletRegistry;
  let eventBus: InMemoryEventBus<CoreEventMap>;

  const TEST_PASSWORD = 'test-password';
  const authMock: jest.Mocked<AuthServiceMock> = {
    getPassword: jest.fn(async () => TEST_PASSWORD),
  };

  const setupBaseBindings = () => {
    hardwareRegistry = new HardwareWalletRegistry();
    eventBus = new InMemoryEventBus<CoreEventMap>();
    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(VaultService).toConstantValue(vaultServiceMock as unknown as VaultService);
    container.bind(HardwareWalletRegistry).toConstantValue(hardwareRegistry);
    container.bind(CORE_IDENTIFIERS.AUTH).toConstantValue(authMock as unknown as AuthService);
    container.bind(CORE_IDENTIFIERS.EVENT_BUS).toConstantValue(eventBus);
    container.bind(SigningService).toSelf();
  };

  const getService = () => container.get(SigningService);

  beforeEach(() => {
    container = new Container({ defaultScope: 'Transient' });
    database = mockDatabase();
    vaultServiceMock = { getPrivateKey: jest.fn() };
    setupBaseBindings();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    container.unbindAll();
  });

  it('returns SoftwareSigner for HD vaults', async () => {
    const { account, address, vault } = await createTestAccount(database, { vaultType: VaultType.HierarchicalDeterministic });
    vaultServiceMock.getPrivateKey.mockResolvedValue('0xabc123');

    const signer = await getService().getSigner(account.id, address.id);

    expect(signer).toBeInstanceOf(SoftwareSigner);
    expect(authMock.getPassword).toHaveBeenCalledWith({ reason: AUTH_REASON.SIGN_TX });
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id, TEST_PASSWORD);
  });

  it('supports private-key vaults', async () => {
    const { account, address, vault } = await createTestAccount(database, { vaultType: VaultType.PrivateKey });
    vaultServiceMock.getPrivateKey.mockResolvedValue('0xdeadbeef');

    const signer = await getService().getSigner(account.id, address.id);

    expect(signer).toBeInstanceOf(SoftwareSigner);
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id, TEST_PASSWORD);
  });

  it('throws when account is missing', async () => {
    const { address } = await createTestAccount(database);

    await expect(getService().getSigner('missing-account', address.id)).rejects.toThrow('Account missing-account not found.');
  });

  it('throws when address is missing', async () => {
    const { account } = await createTestAccount(database);

    await expect(getService().getSigner(account.id, 'missing-address')).rejects.toThrow('Address missing-address not found.');
  });

  it('throws when address does not belong to account', async () => {
    const { account: first } = await createTestAccount(database, { nickname: 'Owner A', selected: true });
    const { address: otherAddress } = await createTestAccount(database, { nickname: 'Owner B', selected: false });

    await expect(getService().getSigner(first.id, otherAddress.id)).rejects.toThrow('Address does not belong to the provided account.');
  });

  it('throws for unsupported vault types', async () => {
    const { account, address } = await createTestAccount(database, { vaultType: VaultType.PublicAddress });

    await expect(getService().getSigner(account.id, address.id)).rejects.toThrow('Vault type public_address does not support signing via SigningService.');
    expect(vaultServiceMock.getPrivateKey).not.toHaveBeenCalled();
  });

  it('propagates VaultService errors', async () => {
    const { account, address, vault } = await createTestAccount(database);
    vaultServiceMock.getPrivateKey.mockRejectedValue(new Error('decrypt failed'));

    await expect(getService().getSigner(account.id, address.id)).rejects.toThrow('decrypt failed');
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id, TEST_PASSWORD);
  });

  it('emits hardware-sign start and failure for personal_sign hardware errors', async () => {
    const { network, assetRule } = await seedNetwork(database, { definitionKey: 'Ethereum Sepolia', selected: true });
    const { account, address } = await createTestAccount(database, {
      vaultType: VaultType.BSIM,
      network,
      assetRule,
    });

    const started: CoreEventMap['hardware-sign/started'][] = [];
    const failed: CoreEventMap['hardware-sign/failed'][] = [];
    eventBus.on('hardware-sign/started', (payload) => started.push(payload));
    eventBus.on('hardware-sign/failed', (payload) => failed.push(payload));

    hardwareRegistry.register(
      HARDWARE_WALLET_TYPES.BSIM,
      undefined,
      createHardwareAdapter(async (_context: SigningContext) => {
        throw { code: 'HARDWARE_FAIL', message: 'Hardware failed.' };
      }),
    );

    await expect(
      getService().signPersonalMessage({
        accountId: account.id,
        addressId: address.id,
        request: {
          from: address.hex.toLowerCase(),
          message: 'hello venus',
        },
      }),
    ).rejects.toMatchObject({ code: 'HARDWARE_FAIL', message: 'Hardware failed.' });

    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      accountId: account.id,
      addressId: address.id,
      networkId: network.id,
    });

    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({
      accountId: account.id,
      addressId: address.id,
      networkId: network.id,
      error: {
        code: 'HARDWARE_FAIL',
        message: 'Hardware failed.',
      },
    });
  });
});
