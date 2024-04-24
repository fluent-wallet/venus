import { type Plugin } from '../';
export { useAccountGroups } from './data/useAccountGroups';
export { useNetworks } from './data/useNetworks';
export { useCurrentNetwork, getCurrentNetwork, useCurrentNetworkNativeAsset, getCurrentNetworkNativeAsset } from './data/useCurrentNetwork';
export { useCurrentAccount } from './data/useCurrentAccount';
export { useCurrentAddress, useCurrentAddressValue } from './data/useCurrentAddress';
export { useAccountsOfGroup } from './data/useAccountsOfGroup';
export { useVaultOfGroup } from './data/useVaultOfGroup';
export { useAddressesOfAccount, useCurrentAddressOfAccount, useCurrentAddressValueOfAccount } from './data/useAddressesOfAccount';
export { useHasBSIMVaultCreated } from './data/useHasBSIMVaultCreated';
export { useVaultFromId } from './data/useVaultFromId';
export { useAccountGroupFromId } from './data/useAccountGroupFromId';
export { useAccountFromId } from './data/useAccountFromId';
export { useGroupOfAccount } from './data/useGroupOfAccount';
export { useVaultOfAccount } from './data/useVaultOfAccount';
export { useVaults } from './data/useVaults';
export { useHasVault } from './data/useHasVault';
export { useCurrentHdPath } from './data/useCurrentHdPath';
export { useFinishedTxs, usePayloadOfTx, useUnfinishedTxs, useAssetOfTx, useRecentlyAddress } from './data/useTxs';
export {
  useAssetsAllList,
  useAssetsNFTList,
  useAssetsTokenList,
  useAssetsTotalPriceValue,
  useAssetsInFetch,
  useIsNftsEmpty,
  useIsTokensEmpty,
  useCurrentOpenNFTDetail,
  getAssetsTokenList,
} from './data/useAssets';
export { useTokenListOfNetwork, useTokenListOfCurrentNetwork } from './data/useReceiveAssets';
export { usePendingRequests, useAllRequests } from './data/useRequests';
export { useAccountsManage, useAccountsOfGroupInManage, useAllAccountsInManage } from './data/useAccountsManage';
export { useGroupFromId } from './data/useGroupFromId';
export { useAddressesOfNetwork } from './data/useAddressesOfNetwork';
export { useAccountOfAddress } from './data/useAccountOfAddress';
export { default as VaultType } from '../../../database/models/Vault/VaultType';
export { default as VaultSourceType } from '../../../database/models/Vault/VaultSourceType';
export { NetworkType, ChainType } from '../../../database/models/Network';
export { AddressType } from '../../../database/models/AddressBook';
export { AssetType, AssetSource } from '../../../database/models/Asset';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    ReactInject: ReactInjectPluginClass;
  }
}

class ReactInjectPluginClass implements Plugin {
  public name = 'ReactInject';
}

export default new ReactInjectPluginClass();
export * from './nexus';
