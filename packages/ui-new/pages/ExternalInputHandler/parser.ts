import { CoreError, WC_PAIR_URI_VERSION_NOT_SUPPORTED, WC_PAIRING_ALREADY_EXISTS } from '@core/errors';
import { ASSET_TYPE, NetworkType } from '@core/types';
import { StackActions } from '@react-navigation/native';
import {
  SendTransactionStackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  type StackNavigation,
} from '@router/configs';
import { isValidAddress } from '@service/address';
import type { IAsset, INetwork } from '@service/core';
import { getWalletConnectService } from '@service/core';
import type { AssetInfo } from '@utils/assetInfo';
import { PaymentUriError, type PaymentUriPayload, parsePaymentUri } from '@utils/payment-uri';
import { toAssetInfo } from '@utils/toAssetInfo';
import Decimal from 'decimal.js';
import type { TFunction } from 'i18next';
import type { PaymentUriParseResult } from './types';

type ParserDeps = {
  currentNetwork: INetwork | null | undefined;
  assets: IAsset[];
  navigation?: StackNavigation;
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  t: TFunction;
  setStatus: (status: PaymentUriParseResult | null) => void;
};

const safeDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const looksLikeWalletConnectWakeUpPayload = (raw: string): boolean => {
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

const normalizeWalletConnectUri = (raw: string): string | null => {
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
      if (!uri) return null;
      if (uri.startsWith('wc:')) return uri;
      const decoded = safeDecodeURIComponent(uri);
      if (decoded.startsWith('wc:')) return decoded;
    } catch {
      return null;
    }
  }

  return null;
};

const getWalletConnectConnectingStatus = (t: ParserDeps['t']): PaymentUriParseResult => ({
  ok: false,
  blocking: true,
  type: 'connecting-wc',
  message: t('wc.connecting'),
});

const setWalletConnectTimeout = (setStatus: ParserDeps['setStatus'], t: ParserDeps['t']) => {
  return setTimeout(() => {
    setStatus({ ok: false, blocking: false, type: 'wc-timeout', message: t('scan.walletConnect.error.timeout') });
  }, 12888);
};

// Ensure the scanned protocol matches current network
const validateProtocol = (paymentUri: PaymentUriPayload, currentNetwork: INetwork, t: ParserDeps['t']): PaymentUriParseResult | null => {
  const expectedProtocol = currentNetwork.networkType === NetworkType.Conflux ? 'conflux' : 'ethereum';
  if (paymentUri.protocol && paymentUri.protocol !== expectedProtocol) {
    return { ok: false, message: t('scan.parse.error.networkMismatch') };
  }
  return null;
};

// Ensure chain id/namespace matches current network
const validateChain = (paymentUri: PaymentUriPayload, currentNetwork: INetwork, t: ParserDeps['t']): PaymentUriParseResult | null => {
  if (currentNetwork.networkType === NetworkType.Ethereum) {
    const requestChainId = paymentUri.network?.chainId?.toLowerCase();
    const currentChainId = currentNetwork.chainId?.toLowerCase();
    if (requestChainId && currentChainId && requestChainId !== currentChainId) {
      return { ok: false, message: t('scan.parse.error.missChianId') };
    }
  } else if (currentNetwork.networkType === NetworkType.Conflux) {
    const expectedNetId = currentNetwork.netId ? String(currentNetwork.netId) : undefined;
    const requestNetId = paymentUri.network?.netId;
    if (expectedNetId && requestNetId && requestNetId !== expectedNetId) {
      return { ok: false, message: t('scan.parse.error.missChianId') };
    }
    const expectedNamespace = (() => {
      if (!expectedNetId) return undefined;
      if (expectedNetId === '1029') return 'cfx';
      if (expectedNetId === '1') return 'cfxtest';
      return `net${expectedNetId}`;
    })();
    const requestNamespace = paymentUri.network?.namespace?.toLowerCase();
    if (expectedNamespace && requestNamespace && requestNamespace !== expectedNamespace.toLowerCase()) {
      return { ok: false, message: t('scan.parse.error.missChianId') };
    }
  }
  return null;
};

// Ensure recipient address is valid on current network
const validateRecipientAddress = (address: string, currentNetwork: INetwork, t: ParserDeps['t']): PaymentUriParseResult | null => {
  if (!isValidAddress({ networkType: currentNetwork.networkType, addressValue: address })) {
    return { ok: false, message: t('scan.parse.error.invalidTargetAddress') };
  }
  return null;
};

// Navigate native transfer flow
const navigateNativeTransfer = (
  paymentUri: PaymentUriPayload,
  navigation: StackNavigation | undefined,
  tokenAssets: AssetInfo[],
  t: ParserDeps['t'],
): PaymentUriParseResult => {
  if (!navigation) return { ok: false, message: t('scan.QRCode.error.notRecognized') };

  const nativeAsset = tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native);
  const rawValue = paymentUri.params?.value ?? paymentUri.params?.uint256;

  // If we can't resolve the native asset yet, fall back to the asset picker to avoid navigating to Step3 with an undefined asset.
  if (!nativeAsset) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStackName, {
        screen: SendTransactionStep2StackName,
        params: { recipientAddress: paymentUri.address },
      }),
    );
    return { ok: true, data: paymentUri };
  }

  if (nativeAsset && rawValue !== undefined) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStackName, {
        screen: SendTransactionStep4StackName,
        params: {
          recipientAddress: paymentUri.address,
          asset: nativeAsset,
          amount: new Decimal(String(rawValue)).div(Decimal.pow(10, nativeAsset.decimals ?? 18)).toString(),
        },
      }),
    );
    return { ok: true, data: paymentUri };
  }

  navigation.dispatch(
    StackActions.replace(SendTransactionStackName, {
      screen: SendTransactionStep3StackName,
      params: { recipientAddress: paymentUri.address, asset: nativeAsset },
    }),
  );
  return { ok: true, data: paymentUri };
};

// Navigate token transfer flow
const navigateTokenTransfer = (
  paymentUri: PaymentUriPayload,
  navigation: StackNavigation | undefined,
  tokenAssets: AssetInfo[],
  t: ParserDeps['t'],
): PaymentUriParseResult => {
  if (!navigation) return { ok: false, message: t('scan.QRCode.error.notRecognized') };

  if (!tokenAssets.length) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStackName, { screen: SendTransactionStep2StackName, params: { recipientAddress: paymentUri.address } }),
    );
    return { ok: true, data: paymentUri };
  }

  const paramAddress = typeof paymentUri.params?.address === 'string' ? paymentUri.params.address : undefined;
  const targetAsset = !paramAddress
    ? tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native)
    : tokenAssets.find((asset) => asset.contractAddress?.toLowerCase() === paramAddress.toLowerCase());

  if (!targetAsset) {
    if (paramAddress) {
      navigation.dispatch(
        StackActions.replace(SendTransactionStackName, {
          screen: SendTransactionStep2StackName,
          params: { recipientAddress: paymentUri.address, searchAddress: paramAddress },
        }),
      );
      return { ok: true, data: paymentUri };
    }
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  const transferValue = paymentUri.params?.uint256 ?? paymentUri.params?.value;
  if (transferValue !== undefined) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStackName, {
        screen: SendTransactionStep4StackName,
        params: {
          recipientAddress: paymentUri.address,
          asset: targetAsset,
          amount: new Decimal(String(transferValue)).div(Decimal.pow(10, targetAsset.decimals ?? 18)).toString(),
        },
      }),
    );
    return { ok: true, data: paymentUri };
  }

  navigation.dispatch(
    StackActions.replace(SendTransactionStackName, {
      screen: SendTransactionStep3StackName,
      params: { recipientAddress: paymentUri.address, asset: targetAsset },
    }),
  );
  return { ok: true, data: paymentUri };
};

// Main parser: validation, WalletConnect, navigation
export const paymentUriParser = async (raw: string, deps: ParserDeps): Promise<PaymentUriParseResult> => {
  const { currentNetwork, onConfirm, navigation, t, setStatus, assets } = deps;

  // WalletConnect wake-up payload (redirect deeplink query without a wc: uri).
  // Example: requestId=...&sessionTopic=...
  if (!onConfirm && looksLikeWalletConnectWakeUpPayload(raw)) {
    const status = getWalletConnectConnectingStatus(t);
    setStatus(status);
    setWalletConnectTimeout(setStatus, t);
    getWalletConnectService()
      .start()
      .catch((error) => console.log(error));
    return status;
  }

  // Raw address
  if (currentNetwork && isValidAddress({ networkType: currentNetwork.networkType, addressValue: raw })) {
    return { ok: true, data: { protocol: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum' : 'conflux', address: raw } };
  }

  // WalletConnect URI
  const wcUri = !onConfirm ? normalizeWalletConnectUri(raw) : null;
  if (wcUri) {
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
  }

  if (!currentNetwork) {
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  let paymentUri: PaymentUriPayload;
  try {
    paymentUri = parsePaymentUri(raw);
  } catch (err) {
    if (err instanceof PaymentUriError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  const protoErr = validateProtocol(paymentUri, currentNetwork, t);
  if (protoErr) return protoErr;

  const chainErr = validateChain(paymentUri, currentNetwork, t);
  if (chainErr) return chainErr;

  const addrErr = validateRecipientAddress(paymentUri.address, currentNetwork, t);
  if (addrErr) return addrErr;

  const tokenAssets = assets.filter((a) => a.type === ASSET_TYPE.Native || a.type === ASSET_TYPE.ERC20).map(toAssetInfo);

  // inline mode: return payload directly, let QrScannerSheet handle onConfirm
  if (onConfirm) {
    return { ok: true, data: paymentUri };
  }

  if (!paymentUri.method) {
    return navigateNativeTransfer(paymentUri, navigation, tokenAssets, t);
  }

  if (paymentUri.method === 'transfer') {
    return navigateTokenTransfer(paymentUri, navigation, tokenAssets, t);
  }

  return { ok: false, message: t('scan.QRCode.error.notRecognized') };
};
