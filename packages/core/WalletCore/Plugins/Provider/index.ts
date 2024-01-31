import { type Plugin } from '../../Plugins';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    Provider: ProviderPluginClass;
  }
}

class ProviderPluginClass implements Plugin {
  public name = 'Provider';
}

export default new ProviderPluginClass();