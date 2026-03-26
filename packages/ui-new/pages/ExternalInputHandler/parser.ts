import type { StackNavigation } from '@router/configs';
import { isValidAddress } from '@service/address';
import type { IAsset, INetwork } from '@service/core';
import { PaymentUriError, type PaymentUriPayload, parsePaymentUri } from '@utils/payment-uri';
import type { TFunction } from 'i18next';
import { getProtocolForNetwork, routeParsedPaymentUri, validatePaymentUriForNetwork } from './paymentUriRouting';
import type { PaymentUriParseResult } from './types';
import { handleWalletConnectUri, handleWalletConnectWakeUp, looksLikeWalletConnectWakeUpPayload, normalizeWalletConnectUri } from './walletConnectInput';

type ParserDeps = {
  currentNetwork: INetwork | null | undefined;
  assets: IAsset[];
  navigation?: StackNavigation;
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  t: TFunction;
  setStatus: (status: PaymentUriParseResult | null) => void;
};

// Main parser: validation, WalletConnect, navigation
export const paymentUriParser = async (raw: string, deps: ParserDeps): Promise<PaymentUriParseResult> => {
  const { currentNetwork, onConfirm, navigation, t, setStatus, assets } = deps;

  // WalletConnect wake-up payload (redirect deeplink query without a wc: uri).
  // Example: requestId=...&sessionTopic=...
  if (!onConfirm && looksLikeWalletConnectWakeUpPayload(raw)) {
    return handleWalletConnectWakeUp({ setStatus, t });
  }

  // Raw address
  if (currentNetwork && isValidAddress({ networkType: currentNetwork.networkType, addressValue: raw })) {
    return { ok: true, data: { protocol: getProtocolForNetwork(currentNetwork.networkType), address: raw } };
  }

  // WalletConnect URI
  const wcUri = !onConfirm ? normalizeWalletConnectUri(raw) : null;
  if (wcUri) {
    return handleWalletConnectUri({ wcUri, setStatus, t });
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

  const validationErr = validatePaymentUriForNetwork({ paymentUri, currentNetwork, t });
  if (validationErr) {
    return validationErr;
  }

  return routeParsedPaymentUri({ paymentUri, assets, navigation, onConfirm, t });
};
