import VaultType from '@core/database/models/Vault/VaultType';

export const VAULT_DEFAULTS = {
  DEVICE: 'ePayWallet',
} as const;

export const VAULT_GROUP_LABEL: Record<VaultType, string> = {
  [VaultType.HierarchicalDeterministic]: 'Seed Phrase',
  [VaultType.PrivateKey]: 'Private Key',
  [VaultType.BSIM]: 'BSIM',
  [VaultType.Hardware]: 'Hardware',
  [VaultType.PublicAddress]: 'Public Address',
};

export const VAULT_ACCOUNT_PREFIX: Record<VaultType, string> = {
  [VaultType.HierarchicalDeterministic]: 'Account',
  [VaultType.PrivateKey]: 'Private Key Account',
  [VaultType.BSIM]: 'BSIM Account',
  [VaultType.Hardware]: 'Hardware Account',
  [VaultType.PublicAddress]: 'Watch Account',
};
