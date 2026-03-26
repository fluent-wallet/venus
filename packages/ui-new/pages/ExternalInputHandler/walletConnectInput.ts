import { CoreError, WC_PAIR_URI_VERSION_NOT_SUPPORTED, WC_PAIRING_ALREADY_EXISTS } from '@core/errors';
import { getWalletConnectService } from '@service/core';
import type { TFunction } from 'i18next';
import type { PaymentUriParseResult } from './types';

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const looksLikeWalletConnectWakeUpPayload = (raw: string): boolean => {
  if (typeof raw !== 'string') return false;
  const s = raw.trim();
  if (!s) return false;
  if (s.startsWith('wc:')) return false;

  // `wc?requestId=...&sessionTopic=...` or other redirect/wakeup payloads.
  if (s.startsWith('wc?')) {
    // If it's a pairing deeplink, it should include `uri=wc:...`.
    // Otherwise treat it as a wake-up redirect to start the WC relayer.
    return !s.includes('uri=');
  }

  // App scheme may also forward raw query fragments.
  if (s.includes('sessionTopic=') || s.includes('requestId=')) return true;

  return false;
};

export const normalizeWalletConnectUri = (raw: string): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('wc:')) return trimmed;

  // Common QR/deeplink format: wc?uri=wc%3A...
  if (trimmed.startsWith('wc?')) {
    const query = trimmed.slice(3);
    const params = new URLSearchParams(query);
    const uri = params.get('uri');
    if (!uri) return null;
    if (uri.startsWith('wc:')) return uri;
    const decoded = safeDecodeURIComponent(uri);
    if (decoded.startsWith('wc:')) return decoded;
    return null;
  }

  // App deeplink format: bimwallet://wc?uri=wc%3A...
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

export const getWalletConnectConnectingStatus = (t: TFunction): PaymentUriParseResult => ({
  ok: false,
  blocking: true,
  type: 'connecting-wc',
  message: t('wc.connecting'),
});

export const setWalletConnectTimeout = (setStatus: (status: PaymentUriParseResult | null) => void, t: TFunction) => {
  return setTimeout(() => {
    setStatus({ ok: false, blocking: false, type: 'wc-timeout', message: t('scan.walletConnect.error.timeout') });
  }, 12888);
};

export const handleWalletConnectWakeUp = (params: { setStatus: (status: PaymentUriParseResult | null) => void; t: TFunction }): PaymentUriParseResult => {
  const { setStatus, t } = params;
  const status = getWalletConnectConnectingStatus(t);
  setStatus(status);
  setWalletConnectTimeout(setStatus, t);
  getWalletConnectService()
    .start()
    .catch((error) => console.log(error));
  return status;
};

export const handleWalletConnectUri = async (params: {
  wcUri: string;
  setStatus: (status: PaymentUriParseResult | null) => void;
  t: TFunction;
}): Promise<PaymentUriParseResult> => {
  const { wcUri, setStatus, t } = params;
  const status = getWalletConnectConnectingStatus(t);
  setStatus(status);

  // Some WalletConnect integrations deep-link with a redirect payload like:
  //   wc:<hash>@2/wc?requestId=...&sessionTopic=...
  // This is not a pairing URI (no relay-protocol/symKey). The redirect is only used to wake up the wallet.
  if (wcUri.includes('/wc?requestId=') && wcUri.includes('sessionTopic=')) {
    // Ensure WalletConnect runtime is started so the relayer can receive pending session requests
    // after the wallet is woken up via redirect deeplink.
    setWalletConnectTimeout(setStatus, t);
    getWalletConnectService()
      .start()
      .catch((error) => console.log(error));
    return status;
  }

  const timeoutId = setWalletConnectTimeout(setStatus, t);

  try {
    await getWalletConnectService().pair(wcUri);
    // Keep "connecting" blocked until runtime event bridge routes, or timeout becomes dismissible.
    return status;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof CoreError) {
      if (err.code === WC_PAIR_URI_VERSION_NOT_SUPPORTED) {
        return { ok: false, message: t('scan.walletConnect.error.lowVersion') };
      }
      if (err.code === WC_PAIRING_ALREADY_EXISTS) {
        const service = getWalletConnectService();
        try {
          await service.start();
        } catch {
          // ignore
        }

        setWalletConnectTimeout(setStatus, t);
        return status;
      }
    }
    return { ok: false, message: `${t('scan.walletConnect.error.connectFailed')} ${String(err ?? '')}` };
  }
};
