import type { IAccount } from '@core/services/account/types';

export type CoreEventMap = {
  'account/current-changed': { account: IAccount };
};
