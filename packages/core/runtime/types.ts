import type { NetworkType } from '@core/utils/consts';
import type { WalletKitTypes } from '@reown/walletkit';
import type { Container } from 'inversify';

export type TimerId = ReturnType<typeof globalThis.setTimeout>;

export type RuntimeScheduler = {
  setTimeout: (handler: () => void, timeoutMs: number) => TimerId;
  clearTimeout: (id: TimerId) => void;
  setInterval: (handler: () => void, intervalMs: number) => TimerId;
  clearInterval: (id: TimerId) => void;
};
export type Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type WalletRuntimeConfig = {
  pendingCountLimit?: number;
  gas?: WalletGasRuntimeConfig;
};

export type WalletGasRuntimeConfig = {
  /**
   * Minimum gas price (in Gwei) by network type.
   * Used primarily as a lower bound for UI manual gas price inputs.
   */
  minGasPriceGweiByNetworkType?: Partial<Record<NetworkType, number>>;

  /**
   * Minimum gas price (in Gwei) by `{ networkType -> chainId }` (e.g. `{ Ethereum: { "0x406": 20 } }`).
   */
  minGasPriceGweiByChain?: Partial<Record<NetworkType, Record<string, number>>>;
};

export type EventBusRuntimeConfig = {
  strictEmit?: boolean;
  assertSerializable?: boolean;
};

export type AuthRuntimeConfig = {
  passwordRequestTtlMs?: number;
};

export type ExternalRequestsRuntimeConfig = {
  requestTtlMs?: number;
  sweepIntervalMs?: number;
  maxActiveRequests?: number;
};

export type WalletConnectRuntimeConfig = {
  // Required when WalletConnectModule is enabled (validated at runtime).
  projectId?: string;
  metadata?: WalletKitTypes.Options['metadata'];

  // Optional; used by ExternalRequestsModule as a fallback.
  requestTtlMs?: number;
  sweepIntervalMs?: number;
  maxActiveRequests?: number;
};

export type TxSyncRuntimeConfig = {
  globalConcurrency?: number;
  highPriorityPollIntervalMs?: number;
  backgroundPollIntervalMs?: number;
  scanIntervalMs?: number;
};

export type AssetsSyncRuntimeConfig = {
  pollIntervalMs?: number;
};

export type NftSyncRuntimeConfig = {
  pollIntervalMs?: number;
  scanOpenApiByKey?: Record<string, string>;
};

export type SyncRuntimeConfig = {
  tx?: TxSyncRuntimeConfig;
  assets?: AssetsSyncRuntimeConfig;
  nft?: NftSyncRuntimeConfig;
};

export type ChainStatusRuntimeConfig = {
  ttlMs?: number;
};

export type RuntimeConfig = {
  wallet?: WalletRuntimeConfig;
  eventBus?: EventBusRuntimeConfig;
  auth?: AuthRuntimeConfig;
  externalRequests?: ExternalRequestsRuntimeConfig;
  walletConnect?: WalletConnectRuntimeConfig;
  sync?: SyncRuntimeConfig;
  chainStatus?: ChainStatusRuntimeConfig;

  [key: string]: unknown;
};

export type RuntimeContext = {
  container: Container;
  logger: Logger;
  config: RuntimeConfig;
  now: () => number;
  scheduler: RuntimeScheduler;
};

export type RuntimeModule = {
  id: string;
  dependencies?: readonly string[];
  register?: (context: RuntimeContext) => void;
  start?: (context: RuntimeContext) => Promise<void> | void;
  stop?: (context: RuntimeContext) => Promise<void> | void;
};
