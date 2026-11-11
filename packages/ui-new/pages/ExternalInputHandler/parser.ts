import { CoreError, WC_PAIR_URI_VERSION_NOT_SUPPORTED } from '@core/errors';
import { ASSET_TYPE } from '@core/types';
import { StackActions } from '@react-navigation/native';
import { SendTransactionStep2StackName, SendTransactionStep3StackName, SendTransactionStep4StackName, type StackNavigation } from '@router/configs';
import type { IAsset } from '@service/core';
import { handleWalletConnectLink, parseWalletConnectLink } from '@service/walletConnectLink';
import type { PaymentRequest } from '@utils/payment-uri';
import { toAssetInfo } from '@utils/toAssetInfo';
import * as OxValue from 'ox/Value';
import { type PaymentInputContext, parsePaymentUriInput } from './paymentInput';
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

const navigateTransfer = (payment: PaymentRequest, navigation: StackNavigation, assets: IAsset[]): void => {
  const paymentAsset = payment.asset;
  const asset = assets.find((candidate) =>
    paymentAsset.type === 'native'
      ? candidate.type === ASSET_TYPE.Native
      : candidate.type === ASSET_TYPE.ERC20 && candidate.contractAddress?.toLowerCase() === paymentAsset.contractAddress.toLowerCase(),
  );

  if (!asset) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStep2StackName, {
        recipientAddress: payment.recipientAddress,
        ...(paymentAsset.type === 'erc20' ? { searchAddress: paymentAsset.contractAddress } : {}),
      }),
    );
    return;
  }

  const params = { recipientAddress: payment.recipientAddress, asset: toAssetInfo(asset) };
  if (payment.amountBaseUnits === undefined) {
    navigation.dispatch(StackActions.replace(SendTransactionStep3StackName, params));
    return;
  }
  navigation.dispatch(
    StackActions.replace(SendTransactionStep4StackName, {
      ...params,
      amount: OxValue.format(payment.amountBaseUnits, params.asset.decimals),
    }),
  );
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

  const paymentResult = parsePaymentUriInput(raw, { currentNetwork, t });
  if (!paymentResult.ok) return paymentResult;
  navigateTransfer(paymentResult.data, navigation, assets);
  return paymentResult;
};
