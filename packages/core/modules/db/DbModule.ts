import { CORE_IDENTIFIERS } from '@core/di';
import type { RuntimeModule } from '@core/runtime/types';
import type { Database } from '@nozbe/watermelondb';
import { DB_MODULE_ID } from '../ids';

export type DbModuleOptions = {
  database: Database;
};

export const createDbModule = (options: DbModuleOptions): RuntimeModule => {
  return {
    id: DB_MODULE_ID,
    register: ({ container }) => {
      if (container.isBound(CORE_IDENTIFIERS.DB)) return;
      container.bind(CORE_IDENTIFIERS.DB).toConstantValue(options.database);
    },
  };
};
