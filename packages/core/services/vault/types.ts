import type { Account } from '@core/database/models/Account';
import type { AccountGroup } from '@core/database/models/AccountGroup';
import type { Address } from '@core/database/models/Address';
import type { AddressBook } from '@core/database/models/AddressBook';
import type { Permission } from '@core/database/models/Permission';
import type { Signature } from '@core/database/models/Signature';
import type { Tx } from '@core/database/models/Tx';
import type { TxExtra } from '@core/database/models/TxExtra';
import type { TxPayload } from '@core/database/models/TxPayload';
import type { Vault } from '@core/database/models/Vault';
import type { HardwareConnectOptions } from '@core/types';
import type { VaultSourceType, VaultType } from '@core/types/vault';

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

export type DeleteVaultPlan = {
  vault: Vault;
  accountGroup: AccountGroup;
  accounts: Account[];
  permissions: Permission[];
  addresses: Address[];
  signatures: Signature[];
  addressBooks: AddressBook[];
  txs: Tx[];
  txPayloads: TxPayload[];
  txExtras: TxExtra[];
};

/**
 * Options for creating a new HD wallet.
 */
export interface CreateHDVaultInput {
  /** If provided, import this mnemonic. Otherwise generate a new one. */
  mnemonic?: string;
  /** Password to encrypt the mnemonic */
  password: string;
  /** Custom name for the first account */
  accountNickname?: string;
}

/**
 * Options for creating a new PrivateKey vault.
 */
export interface CreatePrivateKeyVaultInput {
  privateKey: string;
  password: string;
  accountNickname?: string;
}

/**
 * Options for creating a new BSIM vault.
 * - If `accounts` is provided, VaultService uses it directly (legacy/compatible path).
 * - If `accounts` is omitted, VaultService will call HardwareWalletService.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, connectOptions) and import only the first account.
 */
export interface CreateBSIMVaultInput {
  accounts?: Array<{ index: number; hexAddress: string }>;
  hardwareDeviceId?: string;
  connectOptions?: HardwareConnectOptions;
  /**
   * Optional password used to encrypt a vault marker (e.g. "BSIM Wallet") for legacy password verification flows.
   * - Legacy behavior: BSIM vaults also store an encrypted marker so that "verify password" works even when user only has BSIM vaults.
   */
  password?: string;
}
/**
 * Options for creating a new PublicAddress vault.
 */
export interface CreatePublicAddressVaultInput {
  hexAddress: string;
  accountNickname?: string;
}
