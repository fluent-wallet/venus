import { CORE_IDENTIFIERS } from '@core/di';
import { CoreError, WC_CONFIG_INVALID } from '@core/errors';
import type { RuntimeContext, RuntimeModule } from '@core/runtime/types';
import { WalletKit, type WalletKitTypes } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import type { CoreEventMap, EventBus } from '../eventBus';
import { EVENT_BUS_MODULE_ID, WALLET_CONNECT_MODULE_ID } from '../ids';
import { WalletConnectService } from './WalletConnectService';

type WalletConnectRuntimeConfig = {
  projectId: string;
  metadata: WalletKitTypes.Options['metadata'];
};

const readWalletConnectConfig = (context: RuntimeContext): WalletConnectRuntimeConfig => {
  const raw = (context.config as Record<string, unknown>).walletConnect;
  const cfg = (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null) as Record<string, unknown> | null;

  const projectId = typeof cfg?.projectId === 'string' ? cfg.projectId : null;
  const metadata = cfg?.metadata as WalletKitTypes.Options['metadata'] | undefined;

  if (!projectId || !metadata) {
    throw new CoreError({
      code: WC_CONFIG_INVALID,
      message: 'RuntimeConfig.walletConnect.projectId/metadata is required.',
      context: { hasProjectId: Boolean(projectId), hasMetadata: Boolean(metadata) },
    });
  }

  return { projectId, metadata };
};

export const WalletConnectModule: RuntimeModule = {
  id: WALLET_CONNECT_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID],
  register: (context) => {
    const { container } = context;
    if (container.isBound(WalletConnectService)) return;

    const { projectId, metadata } = readWalletConnectConfig(context);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const clientFactory = async () => {
      const core = new Core({ projectId });
      return WalletKit.init({ core, metadata });
    };

    container.bind(WalletConnectService).toConstantValue(
      new WalletConnectService({
        eventBus,
        logger: context.logger,
        clientFactory,
        closeTransportOnStop: true,
      }),
    );
  },
  start: async ({ container }) => {
    if (!container.isBound(WalletConnectService)) return;
    await container.get(WalletConnectService).start();
  },
  stop: async ({ container }) => {
    if (!container.isBound(WalletConnectService)) return;
    await container.get(WalletConnectService).stop();
  },
};
