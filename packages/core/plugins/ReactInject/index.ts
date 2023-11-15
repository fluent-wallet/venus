import { type Plugin } from '../../plugins/Plugin';
export { useAccountGroups } from './data/useAccountGroups';
export { useStructureGroupData } from './data/useStructureGroupData';
export { useNetworks } from './data/useNetworks';
export { useCurrentNetwork } from './data/useCurrentNetwork';
export { useCurrentAccount } from './data/useCurrentAccount';
export { useCurrentNetworkAddress } from './data/useCurrentNetworkAddress';

class ReactInjectPlugin implements Plugin {
  public name = 'ReactInject';
}

export default ReactInjectPlugin;
export * from './nexus';
