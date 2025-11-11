import 'reflect-metadata';
import type { BSIMPluginClass } from '@WalletCoreExtends/Plugins/BSIM';
import { createTestAccount } from '@core/__tests__/fixtures';
import { mockDatabase } from '@core/__tests__/mocks';
import type { Database } from '@core/database';
import VaultType from '@core/database/models/Vault/VaultType';
import { VaultService } from '@core/services/vault';
import { HardwareSigner, SoftwareSigner } from '@core/signers';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Container } from 'inversify';
import { SigningService } from './SigningService';

type VaultServiceMock = Pick<VaultService, 'getPrivateKey'>;

describe('SigningService', () => {
  let container: Container;
  let database: Database;
  let vaultServiceMock: jest.Mocked<VaultServiceMock>;

  const setupBaseBindings = () => {
    container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
    container.bind(VaultService).toConstantValue(vaultServiceMock as unknown as VaultService);
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
    if (container.isBound('BSIM_PLUGIN')) {
      container.unbind('BSIM_PLUGIN');
    }
    container.unbindAll();
  });

  it('returns SoftwareSigner for HD vaults', async () => {
    const { account, address, vault } = await createTestAccount(database, { vaultType: VaultType.HierarchicalDeterministic });
    vaultServiceMock.getPrivateKey.mockResolvedValue('0xabc123');

    const signer = await getService().getSigner(account.id, address.id);

    expect(signer).toBeInstanceOf(SoftwareSigner);
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id);
  });

  it('supports private-key vaults', async () => {
    const { account, address, vault } = await createTestAccount(database, { vaultType: VaultType.PrivateKey });
    vaultServiceMock.getPrivateKey.mockResolvedValue('0xdeadbeef');

    const signer = await getService().getSigner(account.id, address.id);

    expect(signer).toBeInstanceOf(SoftwareSigner);
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id);
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

  it('throws for BSIM vaults when plugin is absent', async () => {
    const { account, address } = await createTestAccount(database, { vaultType: VaultType.BSIM });

    await expect(getService().getSigner(account.id, address.id)).rejects.toThrow('BSIM plugin is not available.');
  });

  it('returns HardwareSigner for BSIM vaults when plugin is available', async () => {
    const { account, address, network } = await createTestAccount(database, { vaultType: VaultType.BSIM, selected: true });
    const hdPath = await network.hdPath.fetch();
    const bsimPluginMock = { name: 'BSIM' } as unknown as BSIMPluginClass;

    container.bind<BSIMPluginClass>('BSIM_PLUGIN').toConstantValue(bsimPluginMock);
    const signer = await getService().getSigner(account.id, address.id);

    expect(signer).toBeInstanceOf(HardwareSigner);
    expect((signer as HardwareSigner).getDerivationPath()).toBe(`${hdPath.value}/${account.index}`);
    expect((signer as HardwareSigner).getDerivationPath()).toMatch(/^m\/44'\/\d+'\/\d+'\/0\/\d+$/);
    expect((signer as HardwareSigner).getChainType()).toBe(network.networkType);
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
    expect(vaultServiceMock.getPrivateKey).toHaveBeenCalledWith(vault.id, address.id);
  });
});
