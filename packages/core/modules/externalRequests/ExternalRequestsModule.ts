import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeContext, RuntimeModule } from '@core/runtime/types';
import type { CoreEventMap, EventBus } from '../eventBus';
import { EVENT_BUS_MODULE_ID, EXTERNAL_REQUESTS_MODULE_ID } from '../ids';
import { ExternalRequestsService } from './ExternalRequestsService';

type ExternalRequestsRuntimeConfig = {
  requestTtlMs?: number;
  sweepIntervalMs?: number;
  maxActiveRequests?: number;
};

const readExternalRequestsConfig = (context: RuntimeContext): Required<ExternalRequestsRuntimeConfig> => {
  const root = (context.config as Record<string, unknown>) ?? {};

  const fromExternalRequests = root.externalRequests;
  const externalRequestsCfg =
    fromExternalRequests && typeof fromExternalRequests === 'object' ? (fromExternalRequests as Record<string, unknown>) : ({} as Record<string, unknown>);

  const fromWalletConnect = root.walletConnect;
  const walletConnectCfg =
    fromWalletConnect && typeof fromWalletConnect === 'object' ? (fromWalletConnect as Record<string, unknown>) : ({} as Record<string, unknown>);

  const requestTtlMsRaw = externalRequestsCfg.requestTtlMs ?? walletConnectCfg.requestTtlMs;
  const sweepIntervalMsRaw = externalRequestsCfg.sweepIntervalMs ?? walletConnectCfg.sweepIntervalMs;

  const requestTtlMs = typeof requestTtlMsRaw === 'number' && requestTtlMsRaw > 0 ? requestTtlMsRaw : 5 * 60 * 1000;
  const sweepIntervalMs = typeof sweepIntervalMsRaw === 'number' && sweepIntervalMsRaw > 0 ? sweepIntervalMsRaw : 60 * 1000;

  const maxActiveRequestsRaw = externalRequestsCfg.maxActiveRequests ?? walletConnectCfg.maxActiveRequests;
  const maxActiveRequests = typeof maxActiveRequestsRaw === 'number' && maxActiveRequestsRaw > 0 ? maxActiveRequestsRaw : 1;

  return { requestTtlMs, sweepIntervalMs, maxActiveRequests };
};

export const ExternalRequestsModule: RuntimeModule = {
  id: EXTERNAL_REQUESTS_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID],
  register: (context) => {
    const { container } = context;

    if (container.isBound(CORE_IDENTIFIERS.EXTERNAL_REQUESTS)) return;

    const { requestTtlMs, sweepIntervalMs, maxActiveRequests } = readExternalRequestsConfig(context);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const service = new ExternalRequestsService({
      eventBus,
      scheduler: context.scheduler,
      now: context.now,
      logger: context.logger,
      defaultTtlMs: requestTtlMs,
      sweepIntervalMs,
      maxActiveRequests,
    });

    container.bind(CORE_IDENTIFIERS.EXTERNAL_REQUESTS).toConstantValue(service);
  },
  start: ({ container }) => {
    if (!container.isBound(CORE_IDENTIFIERS.EXTERNAL_REQUESTS)) return;
    container.get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS).start();
  },
  stop: ({ container }) => {
    if (!container.isBound(CORE_IDENTIFIERS.EXTERNAL_REQUESTS)) return;
    container.get<ExternalRequestsService>(CORE_IDENTIFIERS.EXTERNAL_REQUESTS).stop();
  },
};
