import { CryptoToolServer } from '@core/modules/crypto/CryptoToolServer';
import { getPasswordCryptoKey } from '@utils/getEnv';
import * as Keychain from 'react-native-keychain';

const KEYCHAIN_SERVICE = 'io.bimwallet';
const KEYCHAIN_USERNAME = 'bim-wallet-user';

const baseKeychainOptions: Keychain.Options = {
  service: KEYCHAIN_SERVICE,
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function requirePasswordCryptoKey(): string {
  const key = getPasswordCryptoKey();
  if (typeof key === 'string' && key.length > 0) return key;
  throw new Error('PASSWORD_CRYPTO_KEY is missing (react-native-config).');
}

export async function hasBiometricVaultPasswordStored(): Promise<boolean> {
  try {
    const services = await Keychain.getAllGenericPasswordServices();
    return services.includes(KEYCHAIN_SERVICE);
  } catch {
    return false;
  }
}

export async function getBiometricVaultPassword(params: { promptTitle: string }): Promise<string> {
  const record = await Keychain.getGenericPassword({
    ...baseKeychainOptions,
    authenticationPrompt: { title: params.promptTitle },
  });

  if (!record || typeof record.password !== 'string' || record.password.length === 0) {
    throw new Error('Biometric vault password is not set.');
  }

  const tool = new CryptoToolServer();
  const passwordCryptoKey = requirePasswordCryptoKey();
  return tool.decrypt<string>(record.password, passwordCryptoKey);
}

export async function getOrCreateBiometricVaultPassword(params: { promptTitle: string }): Promise<string> {
  if (await hasBiometricVaultPasswordStored()) {
    return getBiometricVaultPassword(params);
  }

  const tool = new CryptoToolServer();
  const passwordCryptoKey = requirePasswordCryptoKey();

  // Keep the legacy behavior: generate a high-entropy per-install password protected by biometrics.
  const vaultPassword = `${tool.generateRandomString()}${Date.now()}`;
  const encrypted = await tool.encrypt(vaultPassword, passwordCryptoKey);

  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, encrypted, {
    ...baseKeychainOptions,
    authenticationPrompt: { title: params.promptTitle },
  });

  return vaultPassword;
}
