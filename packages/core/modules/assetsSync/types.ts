export type AssetsSyncKey = { addressId: string; networkId: string };
export type AssetsSyncReason = 'manual' | 'poll' | 'start';

export type AssetsSyncErrorSnapshot = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};
