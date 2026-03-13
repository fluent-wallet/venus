import type { Database } from '@core/database';
import { verifyVaultPassword } from '@core/services/vault/verifyVaultPassword';
import type { CryptoTool } from '@core/types/crypto';
import type { CredentialKind, CredentialKindLoader, CredentialKindSaver, PasswordVerifier } from './AuthService';

const LEGACY_AUTH_KIND_STORAGE_KEY = 'SettleAuthentication';

type CredentialKindStorageAdapter = Readonly<{
  get: <T = unknown>(key: string) => Promise<T | null | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
}>;

function getStorageAdapter(database: Database): CredentialKindStorageAdapter {
  const storage = (database as { localStorage?: CredentialKindStorageAdapter } | null | undefined)?.localStorage;
  if (!storage) {
    throw new Error('Database.localStorage is not available for auth credential persistence.');
  }

  return storage;
}

export function deserializeCredentialKind(value: unknown): CredentialKind | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'password') return 'password';
  if (normalized === 'biometrics') return 'biometrics';

  return null;
}

export function serializeCredentialKind(kind: CredentialKind): 'Password' | 'Biometrics' {
  return kind === 'biometrics' ? 'Biometrics' : 'Password';
}

export function createCredentialKindLoader(database: Database): CredentialKindLoader {
  const storage = getStorageAdapter(database);
  return async () => deserializeCredentialKind(await storage.get(LEGACY_AUTH_KIND_STORAGE_KEY));
}

export function createCredentialKindSaver(database: Database): CredentialKindSaver {
  const storage = getStorageAdapter(database);
  return async (kind) => storage.set(LEGACY_AUTH_KIND_STORAGE_KEY, serializeCredentialKind(kind));
}

export function createPasswordVerifier(params: { database: Database; cryptoTool: CryptoTool }): PasswordVerifier {
  const { database, cryptoTool } = params;
  return async (password) => verifyVaultPassword({ database, cryptoTool, password });
}
