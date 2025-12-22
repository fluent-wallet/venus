import type { IAccount } from '@core/services/account/types';
import type { HardwareOperationError } from '@core/types';

export type CoreEventMap = {
  'account/current-changed': { account: IAccount };

  'hardware-sign/started': { requestId: string; accountId: string; addressId: string; networkId: string };
  'hardware-sign/succeeded': { requestId: string; accountId: string; addressId: string; networkId: string; txHash: string; rawTransaction: string };
  'hardware-sign/failed': { requestId: string; accountId: string; addressId: string; networkId: string; error: HardwareOperationError };
  'hardware-sign/aborted': { requestId: string; accountId: string; addressId: string; networkId: string };

  'tx/created': { key: { addressId: string; networkId: string }; txId: string };
};
