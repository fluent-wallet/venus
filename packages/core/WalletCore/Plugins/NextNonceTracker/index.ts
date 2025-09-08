import type { IPlugin } from '@core/WalletCore/plugin';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { NextNonceTrackerServer } from './server';

export const NextNonceTrackerPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.ASSETS_TRACKER,
  install(context) {
    context.container.bind(SERVICE_IDENTIFIER.NEXT_NONCE_TRACKER).to(NextNonceTrackerServer).inSingletonScope();
  },

  afterInstall(context) {
    const nextNonceTracker: NextNonceTrackerServer = context.container.get<NextNonceTrackerServer>(SERVICE_IDENTIFIER.NEXT_NONCE_TRACKER);

    nextNonceTracker._setup();
  },
};
