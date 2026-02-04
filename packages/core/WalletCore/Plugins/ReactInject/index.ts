import type { Plugin } from '../';

export { AddressType } from '../../../database/models/AddressBook';
export { AssetSource, AssetType } from '../../../database/models/Asset';
export { ChainType, NetworkType } from '../../../database/models/Network';
export { TxStatus } from '../../../database/models/Tx/type';
export { default as VaultSourceType } from '../../../database/models/Vault/VaultSourceType';
export { default as VaultType } from '../../../database/models/Vault/VaultType';
export { useAccountFromId } from './data/useAccountFromId';
export { useAccountGroupFromId } from './data/useAccountGroupFromId';
export { useAccountGroups } from './data/useAccountGroups';
export { useAccountOfAddress } from './data/useAccountOfAddress';
export { useAccountsManage, useAccountsOfGroupInManage, useAllAccountsInManage } from './data/useAccountsManage';
export { useAccountsOfGroup } from './data/useAccountsOfGroup';
export { useAddressesOfAccount, useCurrentAddressOfAccount, useCurrentAddressValueOfAccount } from './data/useAddressesOfAccount';
export { useAddressesOfNetwork } from './data/useAddressesOfNetwork';
export {
  getAssetsTokenList,
  useAssetsAllList,
  useAssetsInFetch,
  useAssetsNFTList,
  useAssetsTokenList,
  useAssetsTotalPriceValue,
  useCurrentOpenNFTDetail,
  useIsNftsEmpty,
  useIsTokensEmpty,
} from './data/useAssets';
export { useCurrentAccount } from './data/useCurrentAccount';
export { getCurrentAddress, getCurrentAddressValue, useCurrentAddress, useCurrentAddressValue } from './data/useCurrentAddress';
export { useCurrentHdPath } from './data/useCurrentHdPath';
export {
  getCurrentNetwork,
  getCurrentNetworkNativeAsset,
  useCurrentNetwork,
  useCurrentNetworkNativeAsset,
  useNativeAssetOfNetwork,
} from './data/useCurrentNetwork';
export { useGroupFromId } from './data/useGroupFromId';
export { useGroupOfAccount } from './data/useGroupOfAccount';
export { useHasBSIMVaultCreated } from './data/useHasBSIMVaultCreated';
export { useHasVault } from './data/useHasVault';
export { useNetworks } from './data/useNetworks';
export { useTokenListOfCurrentNetwork, useTokenListOfNetwork } from './data/useReceiveAssets';
export { useAllRequests, usePendingRequests } from './data/useRequests';
export { useTxFromId } from './data/useTxFromId';
export { isPendingTxsFull, RecentlyType, useAssetOfTx, useFinishedTxs, usePayloadOfTx, useRecentlyAddress, useUnfinishedTxs } from './data/useTxs';
export { useVaultFromId } from './data/useVaultFromId';
export { useVaultOfAccount } from './data/useVaultOfAccount';
export { useVaultOfGroup } from './data/useVaultOfGroup';
export { useVaults } from './data/useVaults';

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
