import type { IAccount } from '@core/services/account/types';
import type { IAsset } from '@core/services/asset/types';
import type { HardwareOperationError } from '@core/types';
import type { ExternalRequestSnapshot } from '../externalRequests/types';

type AssetsSyncKey = { addressId: string; networkId: string };
type AssetsSyncReason = 'manual' | 'poll' | 'start';

type AssetsSyncErrorSnapshot = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

type AssetsSyncEventBase = {
  key: AssetsSyncKey;
  reason: AssetsSyncReason;
  runId: string;
  timestampMs: number;
};
type AssetsSyncSnapshot = {
  assets: IAsset[];
};

export type CoreEventMap = {
  'account/current-changed': { account: IAccount };

  'hardware-sign/started': { requestId: string; accountId: string; addressId: string; networkId: string };
  'hardware-sign/succeeded': { requestId: string; accountId: string; addressId: string; networkId: string; txHash: string; rawTransaction: string };
  'hardware-sign/failed': { requestId: string; accountId: string; addressId: string; networkId: string; error: HardwareOperationError };
  'hardware-sign/aborted': { requestId: string; accountId: string; addressId: string; networkId: string };

  'tx/created': { key: { addressId: string; networkId: string }; txId: string };

  'assets-sync/started': AssetsSyncEventBase;
  'assets-sync/updated': AssetsSyncEventBase & {
    updatedCount: number;
    changedAssetIds?: string[];
  };
  'assets-sync/succeeded': AssetsSyncEventBase & {
    updatedCount: number;
    snapshot: AssetsSyncSnapshot;
  };
  'assets-sync/failed': AssetsSyncEventBase & {
    error: AssetsSyncErrorSnapshot;
  };

  'auth/credential-requested': { requestId: string; kind: 'password' | 'biometrics'; reason?: string };
  'external-requests/requested': { requestId: string; request: ExternalRequestSnapshot };

  'wallet-connect/sessions-changed': {
    reason: 'init' | 'session_delete' | 'disconnect';
    topic?: string;
  };
};
