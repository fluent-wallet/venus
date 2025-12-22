import type { IAccount } from '@core/services/account/types';
import type { HardwareOperationError } from '@core/types';
import type { ExternalRequestSnapshot } from '../externalRequests/types';
export type CoreEventMap = {
  'account/current-changed': { account: IAccount };

  'hardware-sign/started': { requestId: string; accountId: string; addressId: string; networkId: string };
  'hardware-sign/succeeded': { requestId: string; accountId: string; addressId: string; networkId: string; txHash: string; rawTransaction: string };
  'hardware-sign/failed': { requestId: string; accountId: string; addressId: string; networkId: string; error: HardwareOperationError };
  'hardware-sign/aborted': { requestId: string; accountId: string; addressId: string; networkId: string };

  'tx/created': { key: { addressId: string; networkId: string }; txId: string };

  'auth/credential-requested': { requestId: string; kind: 'password' | 'biometrics'; reason?: string };
  'external-requests/requested': { requestId: string; request: ExternalRequestSnapshot };
};
