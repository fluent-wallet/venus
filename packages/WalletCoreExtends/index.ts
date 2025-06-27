import { NewWalletCore } from '../core/WalletCore/index.new';
import { inject, injectable } from 'inversify';
import { EXTENDS_SERVICE_IDENTIFIER } from './service';
import type { IPlugin, PluginContext } from '../core/WalletCore/plugin';
import type { IAuthenticationServer } from './Plugins/Authentication/authenticationServer';
import { container } from '../core/WalletCore/configs';
import type { ICryptoTool } from '../core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '../core/WalletCore/service';
import type { INFTDetailTrackerServerInterface } from '@core/WalletCore/Plugins/NFTDetailTracker/server';
import type { IAssetsTrackerServerInterface } from '@core/WalletCore/Plugins/AssetsTracker/server';
import type { ItxMethodServerInterface } from '@core/WalletCore/Methods/txMethod';
import type { EventBus } from '@core/WalletCore/Events';
@injectable()
export class WalletCoreExtends extends NewWalletCore {
  @inject(EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION)
  authentication!: IAuthenticationServer;

  @inject(SERVICE_IDENTIFIER.CRYPTO_TOOL)
  cryptoTool!: ICryptoTool;

  @inject(SERVICE_IDENTIFIER.NFT_DETAIL_TRACKER)
  NFTDetailTracker!: INFTDetailTrackerServerInterface;

  @inject(SERVICE_IDENTIFIER.ASSETS_TRACKER)
  assetsTracker!: IAssetsTrackerServerInterface;

  @inject(SERVICE_IDENTIFIER.TX_METHOD)
  txMethod!: ItxMethodServerInterface;
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
      return container.get<WalletCoreExtends>(EXTENDS_SERVICE_IDENTIFIER.EXTENDS_CORE);
    },
  };
};

let _core: WalletCoreExtends | null = null;
export const getCore = () => {
  if (!_core) {
    _core = container.get<WalletCoreExtends>(EXTENDS_SERVICE_IDENTIFIER.EXTENDS_CORE);
  }
  return _core;
};

let _eventBus: EventBus | null = null;
export const getEventBus = () => {
  if (!_eventBus) {
    _eventBus = getCore().eventBus;
  }
  return _eventBus;
};

let _authentication: IAuthenticationServer | null = null;
export const getAuthentication = () => {
  if (!_authentication) {
    _authentication = getCore().authentication;
  }
  return _authentication;
};

let _NFTDetailTracker: INFTDetailTrackerServerInterface | null = null;
export const getNFTDetailTracker = () => {
  if (!_NFTDetailTracker) {
    _NFTDetailTracker = getCore().NFTDetailTracker;
  }
  return _NFTDetailTracker;
};

let _AssetsTracker: IAssetsTrackerServerInterface | null = null;
export const getAssetsTracker = () => {
  if (!_AssetsTracker) {
    _AssetsTracker = getCore().assetsTracker;
  }
  return _AssetsTracker;
};
