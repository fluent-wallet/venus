import { CoreError, WC_PAIRING_ALREADY_EXISTS } from '@core/errors';
import { getWalletConnectService } from './core';

export type WalletConnectLink = { type: 'wakeup' } | { type: 'pairing'; uri: string };

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const looksLikeWalletConnectWakeUpPayload = (raw: string): boolean => {
  const value = raw.trim();
  if (!value || value.startsWith('wc:')) return false;
  if (value.startsWith('wc?')) return !value.includes('uri=');
  return value.includes('sessionTopic=') || value.includes('requestId=');
};

const getWalletConnectUri = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('wc:')) return trimmed;

  if (trimmed.startsWith('wc?')) {
    const params = new URLSearchParams(trimmed.slice(3));
    const uri = params.get('uri');
    if (!uri) return null;
    if (uri.startsWith('wc:')) return uri;
    const decoded = safeDecodeURIComponent(uri);
    return decoded.startsWith('wc:') ? decoded : null;
  }

  if (trimmed.startsWith('bimwallet://')) {
    try {
      const url = new URL(trimmed);
      const uri = url.searchParams.get('uri');
      if (uri) {
        if (uri.startsWith('wc:')) return uri;
        const decoded = safeDecodeURIComponent(uri);
        if (decoded.startsWith('wc:')) return decoded;
      }

      const rawQuery = url.search ? safeDecodeURIComponent(url.search.slice(1)) : '';
      if (rawQuery.startsWith('wc:')) return rawQuery;
    } catch {
      return null;
    }
  }

  return null;
};

export function parseWalletConnectLink(raw: string): WalletConnectLink | null {
  if (looksLikeWalletConnectWakeUpPayload(raw)) return { type: 'wakeup' };
  const uri = getWalletConnectUri(raw);
  if (!uri) return null;

  // Incomplete v2 URIs and request redirects only wake the wallet; they do not create a pairing.
  if (/^wc:[^/?]+@2$/.test(uri) || (uri.includes('/wc?requestId=') && uri.includes('sessionTopic='))) {
    return { type: 'wakeup' };
  }

  return { type: 'pairing', uri };
}

export async function handleWalletConnectLink(link: WalletConnectLink): Promise<void> {
  const service = getWalletConnectService();
  if (link.type === 'wakeup') {
    await service.start();
    return;
  }

  try {
    await service.pair(link.uri);
  } catch (error) {
    if (!(error instanceof CoreError) || error.code !== WC_PAIRING_ALREADY_EXISTS) throw error;
    await service.start();
  }
}
