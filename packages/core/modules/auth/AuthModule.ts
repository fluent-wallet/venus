import type { Database } from '@core/database';
import { CORE_IDENTIFIERS } from '@core/di';
import type { AuthRuntimeConfig, RuntimeContext, RuntimeModule } from '@core/runtime/types';
import type { CryptoTool } from '@core/types/crypto';
import type { CoreEventMap, EventBus } from '../eventBus';
import { AUTH_MODULE_ID, CRYPTO_TOOL_MODULE_ID, DB_MODULE_ID, EVENT_BUS_MODULE_ID } from '../ids';
import { createCredentialKindLoader, createCredentialKindSaver, createPasswordVerifier } from './AuthPersistence';
import { AuthService } from './AuthService';

const readAuthConfig = (context: RuntimeContext): Required<AuthRuntimeConfig> => {
  const cfg = context.config.auth ?? {};

  const passwordRequestTtlMs = typeof cfg.passwordRequestTtlMs === 'number' && cfg.passwordRequestTtlMs > 0 ? cfg.passwordRequestTtlMs : 2 * 60 * 1000;

  return { passwordRequestTtlMs };
};

export const AuthModule: RuntimeModule = {
  id: AUTH_MODULE_ID,
  dependencies: [DB_MODULE_ID, CRYPTO_TOOL_MODULE_ID, EVENT_BUS_MODULE_ID],
  register: (context) => {
    const { container } = context;

    if (container.isBound(CORE_IDENTIFIERS.AUTH)) return;

    const { passwordRequestTtlMs } = readAuthConfig(context);
    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const cryptoTool = container.get<CryptoTool>(CORE_IDENTIFIERS.CRYPTO_TOOL);
    const eventBus = container.get<EventBus<CoreEventMap>>(CORE_IDENTIFIERS.EVENT_BUS);

    const auth = new AuthService({
      eventBus,
      scheduler: context.scheduler,
      now: context.now,
      logger: context.logger,
      defaultTimeoutMs: passwordRequestTtlMs,
      loadCredentialKind: createCredentialKindLoader(db),
      saveCredentialKind: createCredentialKindSaver(db),
      verifyPassword: createPasswordVerifier({ database: db, cryptoTool }),
    });

    container.bind(CORE_IDENTIFIERS.AUTH).toConstantValue(auth);
  },
  start: async ({ container }) => {
    if (!container.isBound(CORE_IDENTIFIERS.AUTH)) return;
    await container.get<AuthService>(CORE_IDENTIFIERS.AUTH).hydrateCredentialKind();
  },
  stop: ({ container }) => {
    if (!container.isBound(CORE_IDENTIFIERS.AUTH)) return;
    container.get<AuthService>(CORE_IDENTIFIERS.AUTH).stop();
  },
};
