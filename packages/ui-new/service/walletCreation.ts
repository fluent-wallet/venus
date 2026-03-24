import i18n from '@assets/i18n';
import { AUTH_PASSWORD_REQUEST_CANCELED } from '@core/errors';
import { isValidPrivateKeyHex } from '@core/utils/secp256k1';
import type { RootStackParamList } from '@router/configs';
import { getErrorCode } from '@utils/error';
import { Mnemonic } from 'ethers';
import { getAccountRootKey } from './account';
import { getAccountGroupRootKey } from './accountGroupKeys';
import { getAuthService, getQueryClient, getVaultService } from './core';
import { getVaultRootKey } from './vaultKeys';

export type WalletCreationDisplayType = 'seed_phrase' | 'private_key' | 'bsim';
export type WalletCreationDuplicateDisplayType = Extract<WalletCreationDisplayType, 'seed_phrase' | 'private_key'>;
export type ImportWalletCreationRequest = Extract<WalletCreationRequest, { kind: 'import_mnemonic' | 'import_private_key' }>;

export type ResolveImportWalletRequestResult = { status: 'empty' } | { status: 'invalid' } | { status: 'valid'; request: ImportWalletCreationRequest };

export type WalletCreationRequest =
  | { kind: 'create_hd' }
  | { kind: 'import_mnemonic'; mnemonic: string }
  | { kind: 'import_private_key'; privateKey: string }
  | { kind: 'connect_bsim'; deviceIdentifier?: string };

export type WalletCreationResult =
  | { status: 'success'; displayType: WalletCreationDisplayType }
  | { status: 'duplicate'; displayType: WalletCreationDuplicateDisplayType }
  | { status: 'cancelled'; displayType: WalletCreationDisplayType }
  | { status: 'error'; displayType: WalletCreationDisplayType; error: unknown };

/**
 * Validate raw import text and resolve one executable import request.
 */
export function resolveImportWalletRequest(value: string): ResolveImportWalletRequestResult {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return { status: 'empty' };
  }

  if (Mnemonic.isValidMnemonic(trimmedValue)) {
    return {
      status: 'valid',
      request: { kind: 'import_mnemonic', mnemonic: trimmedValue },
    };
  }

  if (isValidPrivateKeyHex(trimmedValue)) {
    return {
      status: 'valid',
      request: { kind: 'import_private_key', privateKey: trimmedValue },
    };
  }

  return { status: 'invalid' };
}

/**
 * Resolve the user-facing wallet type label from init route params.
 */
export function resolveWalletCreationDisplayType(args: RootStackParamList['Biometrics']): WalletCreationDisplayType {
  if (args?.type === 'connectBSIM') {
    return 'bsim';
  }

  if (args?.type === 'importExistWallet') {
    const resolvedImportRequest = resolveImportWalletRequest(String(args.value ?? ''));
    return resolvedImportRequest.status === 'valid' && resolvedImportRequest.request.kind === 'import_mnemonic' ? 'seed_phrase' : 'private_key';
  }

  return 'seed_phrase';
}

/**
 * Convert init route params into one executable request.
 * Invalid import input fails here before any auth or vault work starts.
 */
export function resolveWalletCreationRequest(args: RootStackParamList['Biometrics']): WalletCreationRequest {
  if (args?.type === 'connectBSIM') {
    return {
      kind: 'connect_bsim',
      deviceIdentifier: args.bsimDeviceId,
    };
  }

  if (args?.type === 'importExistWallet') {
    const resolvedImportRequest = resolveImportWalletRequest(String(args.value ?? ''));

    if (resolvedImportRequest.status !== 'valid') {
      throw new Error(i18n.t('initWallet.error.invalidValue'));
    }

    return resolvedImportRequest.request;
  }

  return { kind: 'create_hd' };
}

function getWalletCreationDisplayLabel(displayType: WalletCreationDisplayType): string {
  if (displayType === 'seed_phrase') {
    return i18n.t('common.seedPhrase');
  }

  if (displayType === 'private_key') {
    return i18n.t('common.privateKey');
  }

  return 'BSIM';
}

function getWalletCreationDisplayType(request: WalletCreationRequest): WalletCreationDisplayType {
  switch (request.kind) {
    case 'create_hd':
    case 'import_mnemonic':
      return 'seed_phrase';
    case 'import_private_key':
      return 'private_key';
    case 'connect_bsim':
      return 'bsim';
  }
}

/**
 * Resolve the password source for wallet creation.
 * A caller can pass a password directly or let auth prompt for it.
 */
async function resolveWalletCreationPassword(providedPassword?: string): Promise<string> {
  if (typeof providedPassword === 'string' && providedPassword.length > 0) {
    return providedPassword;
  }

  return getAuthService().getPassword();
}

/**
 * Refresh wallet-related queries after a new vault changes the local snapshot.
 */
async function invalidateWalletCreationQueries(): Promise<void> {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getVaultRootKey() }),
    queryClient.invalidateQueries({ queryKey: getAccountRootKey() }),
    queryClient.invalidateQueries({ queryKey: getAccountGroupRootKey() }),
  ]);
}

/**
 * Execute one wallet creation request and return an explicit result for the caller.
 * UI feedback stays outside this function.
 */
export async function executeWalletCreation(request: WalletCreationRequest, providedPassword?: string): Promise<WalletCreationResult> {
  const displayType = getWalletCreationDisplayType(request);

  try {
    const vaultService = getVaultService();
    const password = await resolveWalletCreationPassword(providedPassword);

    switch (request.kind) {
      case 'create_hd':
        await vaultService.createHDVault({ password });
        break;
      case 'import_mnemonic': {
        const hasSame = await vaultService.hasExistingSecretImport({
          mnemonic: request.mnemonic,
          password,
        });

        if (hasSame) {
          return { status: 'duplicate', displayType: 'seed_phrase' };
        }

        await vaultService.createHDVault({
          mnemonic: request.mnemonic,
          password,
        });
        break;
      }
      case 'import_private_key': {
        const hasSame = await vaultService.hasExistingSecretImport({
          privateKey: request.privateKey,
          password,
        });

        if (hasSame) {
          return { status: 'duplicate', displayType: 'private_key' };
        }

        await vaultService.createPrivateKeyVault({
          privateKey: request.privateKey,
          password,
        });
        break;
      }
      case 'connect_bsim':
        await vaultService.createBSIMVault({
          connectOptions: {
            deviceIdentifier: request.deviceIdentifier,
          },
          password,
        });
        break;
    }

    await invalidateWalletCreationQueries();
    return { status: 'success', displayType };
  } catch (error) {
    if (getErrorCode(error) === AUTH_PASSWORD_REQUEST_CANCELED) {
      return { status: 'cancelled', displayType };
    }

    return { status: 'error', displayType, error };
  }
}

/**
 * Build the duplicate import message for secret-based wallet creation.
 */
export function getWalletCreationDuplicateMessage(displayType: WalletCreationDuplicateDisplayType): string {
  return i18n.t('initWallet.error.exist', {
    type: getWalletCreationDisplayLabel(displayType),
  });
}

/**
 * Build the generic failure message for wallet creation.
 */
export function getWalletCreationUnknownMessage(displayType: WalletCreationDisplayType): string {
  return i18n.t('initWallet.error.unknown', {
    type: getWalletCreationDisplayLabel(displayType),
  });
}
