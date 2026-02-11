import 'reflect-metadata';
import { createTestAccount } from '@core/testUtils/fixtures';
import { mockDatabase } from '@core/testUtils/mocks';
import type { Database } from '@core/database';
import VaultType from '@core/database/models/Vault/VaultType';
import { CORE_IDENTIFIERS } from '@core/di';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import { AUTH_REASON } from '@core/modules/auth/reasons';
import { VaultService } from '@core/services/vault';
import { SoftwareSigner } from '@core/signers';
import { Container } from 'inversify';
import { SigningService } from './SigningService';

type VaultServiceMock = Pick<VaultService, 'getPrivateKey'>;

describe('SigningService', () => {
  let container: Container;
  let database: Database;
  let vaultServiceMock: jest.Mocked<VaultServiceMock>;
  let hardwareRegistry: HardwareWalletRegistry;

  const TEST_PASSWORD = 'test-password';
  const authMock = {
    getPassword: jest.fn(async () => TEST_PASSWORD),
  };

  const setupBaseBindings = () => {
    hardwareRegistry = new HardwareWalletRegistry();
    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);
    container.bind(VaultService).toConstantValue(vaultServiceMock as unknown as VaultService);
    container.bind(HardwareWalletRegistry).toConstantValue(hardwareRegistry);
    container.bind(CORE_IDENTIFIERS.AUTH).toConstantValue(authMock as any);
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
});
