import database, { type Database } from '@core/database';
import type { IPlugin } from '../plugin';
import { SERVICE_IDENTIFIER } from '../service';

export const DbPlugin: IPlugin = {
  name: SERVICE_IDENTIFIER.DB,

  install(context) {
    context.container.bind<Database>(SERVICE_IDENTIFIER.DB).toConstantValue(database);
  },
};
