import { NewWalletCore } from '../core/WalletCore/index.new';
import { inject, injectable } from 'inversify';
import { EXTENDS_SERVICE_IDENTIFIER } from './service';
import type { IPlugin, PluginContext } from '../core/WalletCore/plugin';
import type { IAuthenticationServer } from './Plugins/Authentication/authenticationServer';
import { container } from '../core/WalletCore/configs';
import type { ICryptoTool } from '../core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '../core/WalletCore/service';
import { EventPlugin } from '../core/WalletCore/Events/EventPlugin';
import { AuthenticationPlugin } from './Plugins/Authentication';
import { CryptoToolPlugin } from './Plugins/CryptoTool';
console.log('Loading WalletCoreExtends...');

@injectable()
export class WalletCoreExtends extends NewWalletCore {
  @inject(EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION)
  authentication!: IAuthenticationServer;

  @inject(SERVICE_IDENTIFIER.CRYPTO_TOOL)
  cryptoTool!: ICryptoTool;
}

export const initCore = (...plugins: IPlugin[]) => {
  const context: PluginContext = { container };

  for (const plugin of plugins) {
    console.log(`Using plugin: ${plugin.name}`);
    plugin.install(context);
  }

  container.bind(EXTENDS_SERVICE_IDENTIFIER.EXTENDS_CORE).to(WalletCoreExtends).inSingletonScope();

  return {
    bootstrap: async () => {
      console.log('Bootstrapping WalletCore...');
      for (const plugin of plugins) {
        if (plugin.afterInstall) {
          await plugin.afterInstall(context);
        }
      }
      console.log('WalletCore bootstrapped successfully!');
    },
  };
};

export const getCore = () => container.get<WalletCoreExtends>(EXTENDS_SERVICE_IDENTIFIER.EXTENDS_CORE);
