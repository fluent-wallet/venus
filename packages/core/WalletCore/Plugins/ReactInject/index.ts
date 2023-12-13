import { type Plugin } from '../';
export { useAccountGroups } from './data/useAccountGroups';
export { useNetworks } from './data/useNetworks';
export { useCurrentNetwork } from './data/useCurrentNetwork';
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
export { useFinishedTxs, usePayloadOfTx, useUnfinishedTxs, useAssetOfTx } from './data/useTxs';

class ReactInjectPluginClass implements Plugin {
  public name = 'ReactInject';
}

export default new ReactInjectPluginClass();
export * from './nexus';
