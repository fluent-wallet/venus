import type { Address } from '@core/types';
import VaultType from '@core/database/models/Vault/VaultType';

/**
 * Lightweight account shape exposed to the UI layer.
 */
export interface IAccount {
  id: string;
  nickname: string;
  address: Address | null;
  balance: string;
  formattedBalance: string;
  isHardwareWallet: boolean;
  vaultType: VaultType;
  selected: boolean;
  hidden: boolean;
}

/**
 * Parameters required when creating a new account in a vault.
 */
export interface CreateAccountInput {
  nickname?: string;
  vaultId: string;
  index?: number;
}
