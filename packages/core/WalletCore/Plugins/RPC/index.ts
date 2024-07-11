import type { Plugin } from '../../Plugins';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    RPC: RPCPluginClass;
  }
}

class RPCPluginClass implements Plugin {
  public name = 'RPC';
}

export default new RPCPluginClass();
