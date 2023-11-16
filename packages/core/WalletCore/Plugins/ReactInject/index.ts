import { type Plugin } from '../';
export { useAccountGroups } from './data/useAccountGroups';
export { useStructureGroupData } from './data/useStructureGroupData';
export { useNetworks } from './data/useNetworks';
export { useCurrentNetwork } from './data/useCurrentNetwork';
export { useCurrentAccount } from './data/useCurrentAccount';
export { useCurrentAddress } from './data/useCurrentAddress';
export { useAccountsOfGroup } from './data/useAccountsOfGroup';
export { useAddressesOfAccount, useCurrentAddressOfAccount } from './data/useAddressesOfAccount';

class ReactInjectPluginClass implements Plugin {
  public name = 'ReactInject';
}

export default new ReactInjectPluginClass();
export * from './nexus';
