import type { IPlugin } from '@core/WalletCore/plugin';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { WALLET_CONFIG_EVENT, WalletConfigServer } from './server';
import { updateAtomWalletConfig } from '../ReactInject/data/useWalletConfig';

export const WalletConfigPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.WALLET_CONFIG,

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.WALLET_CONFIG).to(WalletConfigServer).inSingletonScope();
  },

  afterInstall(context) {
    const walletConfigServer: WalletConfigServer = context.container.get<WalletConfigServer>(SERVICE_IDENTIFIER.WALLET_CONFIG);

    // TODO: Update this
    walletConfigServer.eventBus.on(WALLET_CONFIG_EVENT).subscribe((config) => {
      updateAtomWalletConfig(config);
    });

    walletConfigServer._setup();
  },
};
