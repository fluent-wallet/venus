import type VaultType from '@core/database/models/Vault/VaultType';
import type { Address } from '@core/types';

/**
 * Lightweight account shape exposed to the UI layer.
 */
export interface IAccount {
  id: string;
  nickname: string;
  address: Address;
  balance: string;
  formattedBalance: string;
  isHardwareWallet: boolean;
  vaultType: VaultType;
  accountGroupId: string;
  index: number;
  hidden: boolean;
  selected: boolean;
  currentAddressId: string | null;
}

/**
 * Parameters required when creating a new account in a vault.
 */
export interface CreateAccountInput {
  nickname?: string;
  vaultId: string;
  index?: number;
}
