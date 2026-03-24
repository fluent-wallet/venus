import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import type { QueryClient } from '@tanstack/react-query';
import { getAccountRootKey } from './account';
import { getAccountGroupRootKey } from './accountGroupKeys';
import { getAuthService, getQueryClient, getVaultService } from './core';
import { createTestQueryClient } from './mocks/reactQuery';
import { getVaultRootKey } from './vaultKeys';
import { executeWalletCreation, resolveImportWalletRequest } from './walletCreation';

jest.mock('./core', () => ({
  getAuthService: jest.fn(),
  getQueryClient: jest.fn(),
  getVaultService: jest.fn(),
}));

type VaultServiceMock = {
  hasExistingSecretImport: jest.Mock;
  createHDVault: jest.Mock;
  createPrivateKeyVault: jest.Mock;
  createBSIMVault: jest.Mock;
};

type AuthServiceMock = {
  getPassword: jest.Mock;
};

describe('walletCreation', () => {
  let queryClient: QueryClient;
  let vaultService: VaultServiceMock;
  let authService: AuthServiceMock;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vaultService = {
      hasExistingSecretImport: jest.fn().mockResolvedValue(false),
      createHDVault: jest.fn().mockResolvedValue({ id: 'vault_1' }),
      createPrivateKeyVault: jest.fn().mockResolvedValue({ id: 'vault_1' }),
      createBSIMVault: jest.fn().mockResolvedValue({ id: 'vault_1' }),
    };
    authService = {
      getPassword: jest.fn().mockResolvedValue('prompted-password'),
    };

    (getQueryClient as jest.Mock).mockReturnValue(queryClient);
    (getVaultService as jest.Mock).mockReturnValue(vaultService);
    (getAuthService as jest.Mock).mockReturnValue(authService);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it.each([
    ['empty input', '   ', 'empty'],
    ['invalid input', 'not a secret', 'invalid'],
  ])('resolveImportWalletRequest returns %s status', (_label, value, expectedStatus) => {
    expect(resolveImportWalletRequest(value).status).toBe(expectedStatus);
  });

  it('resolveImportWalletRequest detects mnemonic and private key', () => {
    const mnemonic = resolveImportWalletRequest('test test test test test test test test test test test junk');
    const privateKey = resolveImportWalletRequest('0x4c0883a6910395b7fd1f7d1b6a7d65b2f9b391d4b2666ebadc177a64e1242d5e');

    expect(mnemonic).toEqual({
      status: 'valid',
      request: {
        kind: 'import_mnemonic',
        mnemonic: 'test test test test test test test test test test test junk',
      },
    });
    expect(privateKey).toEqual({
      status: 'valid',
      request: {
        kind: 'import_private_key',
        privateKey: '0x4c0883a6910395b7fd1f7d1b6a7d65b2f9b391d4b2666ebadc177a64e1242d5e',
      },
    });
  });

  it('returns duplicate without creating or invalidating queries', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    vaultService.hasExistingSecretImport.mockResolvedValue(true);

    const result = await executeWalletCreation(
      {
        kind: 'import_mnemonic',
        mnemonic: 'test test test test test test test test test test test junk',
      },
      'provided-password',
    );

    expect(result).toEqual({ status: 'duplicate', displayType: 'seed_phrase' });
    expect(vaultService.createHDVault).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(authService.getPassword).not.toHaveBeenCalled();
  });

  it('creates wallet and invalidates wallet-related caches on success', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const result = await executeWalletCreation({ kind: 'create_hd' });

    expect(result).toEqual({ status: 'success', displayType: 'seed_phrase' });
    expect(authService.getPassword).toHaveBeenCalledTimes(1);
    expect(vaultService.createHDVault).toHaveBeenCalledWith({ password: 'prompted-password' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getVaultRootKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountRootKey() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: getAccountGroupRootKey() });
  });

  it('returns cancelled when password prompt is cancelled', async () => {
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
    authService.getPassword.mockRejectedValue({ code: AUTH_PASSWORD_REQUEST_CANCELED });

    const result = await executeWalletCreation({ kind: 'connect_bsim', deviceIdentifier: 'device_1' });

    expect(result).toEqual({ status: 'cancelled', displayType: 'bsim' });
    expect(vaultService.createBSIMVault).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
