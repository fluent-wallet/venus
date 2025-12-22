import type { RuntimeModule } from '@core/runtime/types';
import { registerServices } from '@core/services';
import { VaultService } from '@core/services/vault';
import { CRYPTO_TOOL_MODULE_ID, DB_MODULE_ID, EVENT_BUS_MODULE_ID, SERVICES_MODULE_ID } from '../ids';

export const ServicesModule: RuntimeModule = {
  id: SERVICES_MODULE_ID,
  dependencies: [DB_MODULE_ID, CRYPTO_TOOL_MODULE_ID, EVENT_BUS_MODULE_ID],
  register: ({ container }) => {
    if (container.isBound(VaultService)) return;
    registerServices(container);
  },
};
