import i18n from '@assets/i18n';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import type { RootStackParamList } from '@router/configs';
import { getAuthService, getVaultService } from '@service/core';
import { Mnemonic } from 'ethers';
import { showMessage } from 'react-native-flash-message';

type CreateVaultErrorType = 'SeedPhrase' | 'PrivateKey' | 'BSIM';
type CreateVaultResult = boolean | undefined;

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const maybe = error as { code?: unknown };
  if (typeof maybe.code === 'string') return maybe.code;
  return undefined;
}

function resolveErrorType(args: RootStackParamList['Biometrics']): CreateVaultErrorType {
  if (args?.type === 'connectBSIM') return 'BSIM';

  if (args?.type === 'importExistWallet') {
    const value = String(args.value ?? '').trim();
    if (Mnemonic.isValidMnemonic(value)) return 'SeedPhrase';
    return 'PrivateKey';
  }

  // createNewWallet (or missing params) defaults to SeedPhrase
  return 'SeedPhrase';
}

const createVaultWithRouterParams = async (args: RootStackParamList['Biometrics'], password?: string): Promise<CreateVaultResult> => {
  const errorType = resolveErrorType(args);

  try {
    const vaultService = getVaultService();

    const requirePassword = async (): Promise<string> => {
      if (typeof password === 'string' && password.length > 0) return password;
      // Only resolve AuthService when we actually need to prompt user.
      return getAuthService().getPassword();
    };

    if (args?.type === 'importExistWallet') {
      const value = String(args.value ?? '').trim();
      if (!value) {
        throw new Error(i18n.t('initWallet.error.invalidValue'));
      }

      const isMnemonic = Mnemonic.isValidMnemonic(value);
      const hasSame = await vaultService.hasExistingSecretImport(isMnemonic ? { mnemonic: value } : { privateKey: value });
      if (hasSame) {
        showMessage({
          message: i18n.t('initWallet.error.exist', { type: isMnemonic ? i18n.t('common.seedPhrase') : i18n.t('common.privateKey') }),
          type: 'failed',
        });
        return;
      }

      const resolvedPassword = await requirePassword();
      if (isMnemonic) {
        await vaultService.createHDVault({ mnemonic: value, password: resolvedPassword });
      } else {
        await vaultService.createPrivateKeyVault({ privateKey: value, password: resolvedPassword });
      }

      return true;
    }

    if (args?.type === 'connectBSIM') {
      const resolvedPassword = await requirePassword();
      await vaultService.createBSIMVault({
        connectOptions: { deviceIdentifier: args.bsimDeviceId },
        password: resolvedPassword,
      });
      return true;
    }

    // createNewWallet (or missing type) defaults to HD
    const resolvedPassword = await requirePassword();
    await vaultService.createHDVault({ password: resolvedPassword });
    return true;
  } catch (error) {
    if (getErrorCode(error) === AUTH_PASSWORD_REQUEST_CANCELED) {
      return;
    }

    const typeMap: Record<CreateVaultErrorType, string> = {
      SeedPhrase: i18n.t('common.seedPhrase'),
      PrivateKey: i18n.t('common.privateKey'),
      BSIM: 'BSIM',
    };

    showMessage({
      message: i18n.t('initWallet.error.unknown', { type: typeMap[errorType] }),
      description: String(error ?? ''),
      type: 'failed',
    });
    return false;
  }
};

export default createVaultWithRouterParams;
