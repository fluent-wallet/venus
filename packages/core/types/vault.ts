export const VaultType = {
  PublicAddress: 'public_address',
  PrivateKey: 'private_key',
  HierarchicalDeterministic: 'hierarchical_deterministic',
  Hardware: 'hardware',
  BSIM: 'BSIM',
} as const;

export type VaultType = (typeof VaultType)[keyof typeof VaultType];

export const VaultSourceType = {
  CREATE_BY_WALLET: 'CREATE_BY_WALLET',
  IMPORT_BY_USER: 'IMPORT_BY_USER',
} as const;

export type VaultSourceType = (typeof VaultSourceType)[keyof typeof VaultSourceType];
