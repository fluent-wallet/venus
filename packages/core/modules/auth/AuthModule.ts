import { CORE_IDENTIFIERS } from '@core/di';
import type { AuthRuntimeConfig, RuntimeContext, RuntimeModule } from '@core/runtime/types';
import type { CoreEventMap, EventBus } from '../eventBus';
import { AUTH_MODULE_ID, EVENT_BUS_MODULE_ID } from '../ids';
import { AuthService } from './AuthService';

const readAuthConfig = (context: RuntimeContext): Required<AuthRuntimeConfig> => {
  const cfg = context.config.auth ?? {};

  const passwordRequestTtlMs = typeof cfg.passwordRequestTtlMs === 'number' && cfg.passwordRequestTtlMs > 0 ? cfg.passwordRequestTtlMs : 2 * 60 * 1000;

  return { passwordRequestTtlMs };
};

export const AuthModule: RuntimeModule = {
  id: AUTH_MODULE_ID,
  dependencies: [EVENT_BUS_MODULE_ID],
  register: (context) => {
    const { container } = context;

    if (container.isBound(CORE_IDENTIFIERS.AUTH)) return;

    const { passwordRequestTtlMs } = readAuthConfig(context);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const auth = new AuthService({
      eventBus,
      scheduler: context.scheduler,
      now: context.now,
      logger: context.logger,
      defaultTimeoutMs: passwordRequestTtlMs,
    });

    container.bind(CORE_IDENTIFIERS.AUTH).toConstantValue(auth);
  },
  stop: ({ container }) => {
    if (!container.isBound(CORE_IDENTIFIERS.AUTH)) return;
    container.get<AuthService>(CORE_IDENTIFIERS.AUTH).stop();
  },
};
