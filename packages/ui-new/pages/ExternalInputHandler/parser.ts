import { CoreError, WC_PAIR_URI_VERSION_NOT_SUPPORTED } from '@core/errors';
import { ASSET_TYPE } from '@core/types';
import { StackActions } from '@react-navigation/native';
import { SendTransactionStep2StackName, SendTransactionStep3StackName, SendTransactionStep4StackName, type StackNavigation } from '@router/configs';
import type { IAsset } from '@service/core';
import { handleWalletConnectLink, parseWalletConnectLink } from '@service/walletConnectLink';
import type { AssetInfo } from '@utils/assetInfo';
import type { PaymentUriPayload } from '@utils/payment-uri';
import { toAssetInfo } from '@utils/toAssetInfo';
import Decimal from 'decimal.js';
import { type PaymentInputContext, parsePaymentUriInput, parseRawAddress } from './paymentInput';
import type { PaymentUriParseResult } from './types';

type ExternalInputDeps = PaymentInputContext & {
  assets: IAsset[];
  navigation: StackNavigation;
  setStatus: (status: PaymentUriParseResult | null) => void;
};

const getWalletConnectConnectingStatus = (t: ExternalInputDeps['t']): PaymentUriParseResult => ({
  ok: false,
  blocking: true,
  type: 'connecting-wc',
  message: t('wc.connecting'),
});

const setWalletConnectTimeout = (setStatus: ExternalInputDeps['setStatus'], t: ExternalInputDeps['t']) => {
  return setTimeout(() => {
    setStatus({ ok: false, blocking: false, type: 'wc-timeout', message: t('scan.walletConnect.error.timeout') });
  }, 12888);
};

// Navigate native transfer flow
const navigateNativeTransfer = (paymentUri: PaymentUriPayload, navigation: StackNavigation, tokenAssets: AssetInfo[]): PaymentUriParseResult => {
  const nativeAsset = tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native);
  const rawValue = paymentUri.params?.value ?? paymentUri.params?.uint256;

  // If we can't resolve the native asset yet, fall back to the asset picker to avoid navigating to Step3 with an undefined asset.
  if (!nativeAsset) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStep2StackName, {
        recipientAddress: paymentUri.address,
      }),
    );
    return { ok: true, data: paymentUri };
  }

  if (nativeAsset && rawValue !== undefined) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStep4StackName, {
        recipientAddress: paymentUri.address,
        asset: nativeAsset,
        amount: new Decimal(String(rawValue)).div(Decimal.pow(10, nativeAsset.decimals ?? 18)).toString(),
      }),
    );
    return { ok: true, data: paymentUri };
  }

  navigation.dispatch(
    StackActions.replace(SendTransactionStep3StackName, {
      recipientAddress: paymentUri.address,
      asset: nativeAsset,
    }),
  );
  return { ok: true, data: paymentUri };
};

// Navigate token transfer flow
const navigateTokenTransfer = (
  paymentUri: PaymentUriPayload,
  navigation: StackNavigation,
  tokenAssets: AssetInfo[],
  t: ExternalInputDeps['t'],
): PaymentUriParseResult => {
  if (!tokenAssets.length) {
    navigation.dispatch(StackActions.replace(SendTransactionStep2StackName, { recipientAddress: paymentUri.address }));
    return { ok: true, data: paymentUri };
  }

  const paramAddress = typeof paymentUri.params?.address === 'string' ? paymentUri.params.address : undefined;
  const targetAsset = !paramAddress
    ? tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native)
    : tokenAssets.find((asset) => asset.contractAddress?.toLowerCase() === paramAddress.toLowerCase());

  if (!targetAsset) {
    if (paramAddress) {
      navigation.dispatch(
        StackActions.replace(SendTransactionStep2StackName, {
          recipientAddress: paymentUri.address,
          searchAddress: paramAddress,
        }),
      );
      return { ok: true, data: paymentUri };
    }
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  const transferValue = paymentUri.params?.uint256 ?? paymentUri.params?.value;
  if (transferValue !== undefined) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStep4StackName, {
        recipientAddress: paymentUri.address,
        asset: targetAsset,
        amount: new Decimal(String(transferValue)).div(Decimal.pow(10, targetAsset.decimals ?? 18)).toString(),
      }),
    );
    return { ok: true, data: paymentUri };
  }

  navigation.dispatch(
    StackActions.replace(SendTransactionStep3StackName, {
      recipientAddress: paymentUri.address,
      asset: targetAsset,
    }),
  );
  return { ok: true, data: paymentUri };
};

export const handleExternalInput = async (raw: string, deps: ExternalInputDeps): Promise<PaymentUriParseResult> => {
  const { currentNetwork, navigation, t, setStatus, assets } = deps;

  const walletConnectLink = parseWalletConnectLink(raw);
  if (walletConnectLink) {
    const status = getWalletConnectConnectingStatus(t);
    setStatus(status);

    const timeoutId = setWalletConnectTimeout(setStatus, t);

    try {
      await handleWalletConnectLink(walletConnectLink);
      // Keep "connecting" blocked until runtime event bridge routes, or timeout becomes dismissible.
      return status;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof CoreError) {
        if (err.code === WC_PAIR_URI_VERSION_NOT_SUPPORTED) {
          return { ok: false, message: t('scan.walletConnect.error.lowVersion') };
        }
      }
      return { ok: false, message: `${t('scan.walletConnect.error.connectFailed')} ${String(err ?? '')}` };
    }
  }

  const addressPaymentUri = parseRawAddress(raw, currentNetwork);
  if (addressPaymentUri) return { ok: true, data: addressPaymentUri };

  const paymentResult = parsePaymentUriInput(raw, { currentNetwork, t });
  if (!paymentResult.ok) return paymentResult;
  const paymentUri = paymentResult.data;

  const tokenAssets = assets.filter((a) => a.type === ASSET_TYPE.Native || a.type === ASSET_TYPE.ERC20).map(toAssetInfo);

  if (!paymentUri.method) {
    return navigateNativeTransfer(paymentUri, navigation, tokenAssets);
  }

  if (paymentUri.method === 'transfer') {
    return navigateTokenTransfer(paymentUri, navigation, tokenAssets, t);
  }

  return { ok: false, message: t('scan.QRCode.error.notRecognized') };
};
