import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import type { Database } from '@nozbe/watermelondb';

export type DbModuleOptions = {
  database: Database;
};

export const createDbModule = (options: DbModuleOptions): RuntimeModule => {
  return {
    id: 'db',
    register: ({ container }) => {
      if (container.isBound(CORE_IDENTIFIERS.DB)) return;
      container.bind(CORE_IDENTIFIERS.DB).toConstantValue(options.database);
    },
  };
};
