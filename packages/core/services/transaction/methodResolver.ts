import { iface721, iface777, iface1155 } from '@core/contracts';
import { AssetType, type AssetTypeValue } from '@core/types';

type MethodPayloadLike = {
  to?: string | null;
  data?: string | null;
};

export type ResolveTransactionMethodInput = {
  txMethod?: string | null;
  extraMethod?: string | null;
  payload: MethodPayloadLike;
  assetType?: AssetTypeValue | null;
};

const normalizeMethod = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '';
};

const tryParseMethodFromData = (data: string | null | undefined): string => {
  if (!data || data === '0x') return '';

  for (const iface of [iface777, iface721, iface1155]) {
    try {
      const parsed = iface.parseTransaction({ data });
      const name = parsed?.name?.trim();
      if (name) return name;
    } catch {
      // Ignore unknown selectors and continue.
    }
  }

  return '';
};

const fallbackMethodByAssetType = (assetType: AssetTypeValue | null | undefined): string => {
  switch (assetType) {
    case AssetType.Native:
      return 'transfer';
    case AssetType.ERC20:
      return 'transfer';
    case AssetType.ERC721:
      return 'transferFrom';
    case AssetType.ERC1155:
      return 'safeTransferFrom';
    default:
      return '';
  }
};

export const resolveTransactionMethod = ({ txMethod, extraMethod, payload, assetType = null }: ResolveTransactionMethodInput): string => {
  const persistedMethod = normalizeMethod(txMethod) || normalizeMethod(extraMethod);
  if (persistedMethod) return persistedMethod;

  const parsedMethod = tryParseMethodFromData(payload.data);
  if (parsedMethod) return parsedMethod;

  if (payload.to) {
    const byAssetType = fallbackMethodByAssetType(assetType);
    if (byAssetType) return byAssetType;

    if (!payload.data || payload.data === '0x') {
      return 'transfer';
    }
  }

  return '';
};
