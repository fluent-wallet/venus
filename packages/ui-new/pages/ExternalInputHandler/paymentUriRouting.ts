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
import type { AssetInfo } from '@utils/assetInfo';
import type { PaymentUriPayload } from '@utils/payment-uri';
import { toAssetInfo } from '@utils/toAssetInfo';
import Decimal from 'decimal.js';
import type { TFunction } from 'i18next';
import type { PaymentUriParseResult } from './types';

export const getProtocolForNetwork = (networkType: INetwork['networkType']) => {
  return networkType === NetworkType.Ethereum ? 'ethereum' : 'conflux';
};

export const validatePaymentUriForNetwork = (params: {
  paymentUri: PaymentUriPayload;
  currentNetwork: INetwork;
  t: TFunction;
}): PaymentUriParseResult | null => {
  const { paymentUri, currentNetwork, t } = params;
  const expectedProtocol = getProtocolForNetwork(currentNetwork.networkType);

  if (paymentUri.protocol && paymentUri.protocol !== expectedProtocol) {
    return { ok: false, message: t('scan.parse.error.networkMismatch') };
  }

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

  if (!isValidAddress({ networkType: currentNetwork.networkType, addressValue: paymentUri.address })) {
    return { ok: false, message: t('scan.parse.error.invalidTargetAddress') };
  }

  return null;
};

const navigateNativeTransfer = (params: {
  paymentUri: PaymentUriPayload;
  navigation?: StackNavigation;
  tokenAssets: AssetInfo[];
  t: TFunction;
}): PaymentUriParseResult => {
  const { paymentUri, navigation, tokenAssets, t } = params;
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

  if (rawValue !== undefined) {
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

const navigateTokenTransfer = (params: {
  paymentUri: PaymentUriPayload;
  navigation?: StackNavigation;
  tokenAssets: AssetInfo[];
  t: TFunction;
}): PaymentUriParseResult => {
  const { paymentUri, navigation, tokenAssets, t } = params;
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

export const routeParsedPaymentUri = (params: {
  paymentUri: PaymentUriPayload;
  assets: IAsset[];
  navigation?: StackNavigation;
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  t: TFunction;
}): PaymentUriParseResult => {
  const { paymentUri, assets, navigation, onConfirm, t } = params;
  const tokenAssets = assets.filter((a) => a.type === ASSET_TYPE.Native || a.type === ASSET_TYPE.ERC20).map(toAssetInfo);

  // inline mode: return payload directly, let QrScannerSheet handle onConfirm
  if (onConfirm) {
    return { ok: true, data: paymentUri };
  }

  if (!paymentUri.method) {
    return navigateNativeTransfer({ paymentUri, navigation, tokenAssets, t });
  }

  if (paymentUri.method === 'transfer') {
    return navigateTokenTransfer({ paymentUri, navigation, tokenAssets, t });
  }

  return { ok: false, message: t('scan.QRCode.error.notRecognized') };
};
