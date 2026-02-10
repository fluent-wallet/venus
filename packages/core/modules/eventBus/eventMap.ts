import type { IAccount } from '@core/services/account/types';
import type { IAsset } from '@core/services/asset/types';
import type { INetwork } from '@core/services/network/types';
import type { HardwareOperationError } from '@core/types';
import type { AuthReason } from '../auth/reasons';
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

type NftSyncKey = { addressId: string; networkId: string; contractAddress: string };
type NftSyncReason = 'manual' | 'poll' | 'start';

type NftSyncErrorSnapshot = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

type NftSyncItemDetail = {
  name: string;
  description?: string | null;
  icon?: string | null;
  amount: string;
  tokenId: string;
};

type NftSyncEventBase = {
  key: NftSyncKey;
  reason: NftSyncReason;
  runId: string;
  timestampMs: number;
};

type NftSyncSnapshot = {
  contractAddress: string;
  items: NftSyncItemDetail[];
};

export type CoreEventMap = {
  'account/current-changed': { account: IAccount };
  'network/current-changed': { network: INetwork };

  'hardware-sign/started': { requestId: string; accountId: string; addressId: string; networkId: string };
  'hardware-sign/succeeded': { requestId: string; accountId: string; addressId: string; networkId: string; txHash: string; rawTransaction: string };
  'hardware-sign/failed': { requestId: string; accountId: string; addressId: string; networkId: string; error: HardwareOperationError };
  'hardware-sign/aborted': { requestId: string; accountId: string; addressId: string; networkId: string };

  'tx/created': { key: { addressId: string; networkId: string }; txId: string };
  'tx/updated': {
    key: { addressId: string; networkId: string };
    txIds: string[];
    timestampMs: number;
  };

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

  'nft-sync/started': NftSyncEventBase;
  'nft-sync/updated': NftSyncEventBase & {
    updatedCount: number;
  };
  'nft-sync/succeeded': NftSyncEventBase & {
    updatedCount: number;
    snapshot: NftSyncSnapshot;
  };
  'nft-sync/failed': NftSyncEventBase & {
    error: NftSyncErrorSnapshot;
  };

  'auth/credential-requested': { requestId: string; kind: 'password' | 'biometrics'; reason?: AuthReason };
  'external-requests/requested': { requestId: string; request: ExternalRequestSnapshot };

  'wallet-connect/sessions-changed': {
    reason: 'init' | 'session_delete' | 'disconnect';
    topic?: string;
  };

  'receive-assets-sync/started': {
    networkId: string;
    reason: 'start' | 'network_changed' | 'manual';
    runId: string;
    timestampMs: number;
  };
  'receive-assets-sync/succeeded': {
    networkId: string;
    reason: 'start' | 'network_changed' | 'manual';
    runId: string;
    timestampMs: number;
    createdCount: number;
    updatedCount: number;
  };
  'receive-assets-sync/failed': {
    networkId: string;
    reason: 'start' | 'network_changed' | 'manual';
    runId: string;
    timestampMs: number;
    error: { code: string; message: string; context?: Record<string, unknown> };
  };
};
