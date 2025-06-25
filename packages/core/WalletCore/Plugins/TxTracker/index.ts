import type { IPlugin } from '@core/WalletCore/plugin';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { TxTrackerServer } from './server';

// class TxTrackerPluginClass implements Plugin {

export const TxTrackerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.TX_TRACKER,

  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.TX_TRACKER).to(TxTrackerServer).inSingletonScope();
  },

  afterInstall(context) {
    const txTrackerServer = context.container.get<TxTrackerServer>(SERVICE_IDENTIFIER.TX_TRACKER);
    txTrackerServer._setup();
  },
};
