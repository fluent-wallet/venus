import type VaultSourceType from '@core/database/models/Vault/VaultSourceType';
import type VaultType from '@core/database/models/Vault/VaultType';

/**
 * Vault snapshot returned by VaultService.
 * This is a plain object, not a database model.
 */
export interface IVault {
  id: string;
  type: VaultType;
  device: string;
  /** Has the user backed up this vault? */
  isBackup: boolean;
  /** Was this imported or created by the wallet? */
  source: VaultSourceType;
  isGroup: boolean;
  accountGroupId: string;
}

/**
 * Options for creating a new HD wallet.
 */
export interface CreateHDVaultInput {
  /** If provided, import this mnemonic. Otherwise generate a new one. */
  mnemonic?: string;
  /** Password to encrypt the mnemonic */
  password?: string;
  /** Custom name for the first account */
  accountNickname?: string;
}
