export enum AssetType {
  Native = 'Native',
  ERC20 = 'ERC20',
  ERC721 = 'ERC721',
  ERC1155 = 'ERC1155',
}

export const ASSET_TYPE = {
  Native: 'Native',
  ERC20: 'ERC20',
  ERC721: 'ERC721',
  ERC1155: 'ERC1155',
} as const;

export type AssetTypeValue = (typeof ASSET_TYPE)[keyof typeof ASSET_TYPE];

export const ASSET_SOURCE = {
  Custom: 'Custom',
  Official: 'Official',
} as const;

export type AssetSource = (typeof ASSET_SOURCE)[keyof typeof ASSET_SOURCE];
