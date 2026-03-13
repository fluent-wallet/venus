import { CORE_IDENTIFIERS } from '@core/di';
import type { EventBusRuntimeConfig, RuntimeContext, RuntimeModule } from '@core/runtime/types';
import { EVENT_BUS_MODULE_ID } from '../ids';
import { InMemoryEventBus } from './EventBus';
import type { CoreEventMap } from './eventMap';

const readEventBusConfig = (context: RuntimeContext): Required<EventBusRuntimeConfig> => {
  const cfg = context.config.eventBus ?? {};

  const strictEmit = typeof cfg.strictEmit === 'boolean' ? cfg.strictEmit : false;
  const assertSerializable = typeof cfg.assertSerializable === 'boolean' ? cfg.assertSerializable : false;

  return { strictEmit, assertSerializable };
};

export const EventBusModule: RuntimeModule = {
  id: EVENT_BUS_MODULE_ID,
  register: (context) => {
    const { container } = context;

    if (container.isBound(CORE_IDENTIFIERS.EVENT_BUS)) return;

    const { strictEmit, assertSerializable } = readEventBusConfig(context);

    const bus = new InMemoryEventBus<CoreEventMap>({
      logger: context.logger,
      strictEmit,
      assertSerializable,
    });

    container.bind(CORE_IDENTIFIERS.EVENT_BUS).toConstantValue(bus);
  },
};
