import type VaultSourceType from '@core/database/models/Vault/VaultSourceType';
import type VaultType from '@core/database/models/Vault/VaultType';
import type { HardwareConnectOptions } from '@core/types';

/**
 * Vault snapshot returned by VaultService.
 * This is a plain object, not a database model.
 */
export interface IVault {
  id: string;
  type: VaultType;
  device: string;
  /** Optional identifier for paired hardware (BLE UUID, ICCID, etc.) */
  hardwareDeviceId: string | null;
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

/**
 * Options for creating a new PrivateKey vault.
 */
export interface CreatePrivateKeyVaultInput {
  privateKey: string;
  password?: string;
  accountNickname?: string;
}

/**
 * Options for creating a new BSIM vault.
 * - If `accounts` is provided, VaultService uses it directly (legacy/compatible path).
 * - If `accounts` is omitted, VaultService will call HardwareWalletService.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, connectOptions).
 */
export interface CreateBSIMVaultInput {
  accounts?: Array<{ index: number; hexAddress: string }>;
  hardwareDeviceId?: string;
  connectOptions?: HardwareConnectOptions;
}
/**
 * Options for creating a new PublicAddress vault.
 */
export interface CreatePublicAddressVaultInput {
  hexAddress: string;
  accountNickname?: string;
}
