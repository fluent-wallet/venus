import { ASSET_TYPE, NetworkType } from '@core/types';
import { type SendEntry, toTransferAssetFromIAsset } from '@pages/SendTransaction/flow';
import { StackActions } from '@react-navigation/native';
import { SendTransactionStackName, type StackNavigation } from '@router/configs';
import { isValidAddress } from '@service/address';
import type { IAsset, INetwork } from '@service/core';
import type { PaymentUriPayload } from '@utils/payment-uri';
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

function navigateToSendEntry(params: { entry: SendEntry; paymentUri: PaymentUriPayload; navigation: StackNavigation }): PaymentUriParseResult {
  const { entry, paymentUri, navigation } = params;

  // Route payment URIs through the send entry.
  navigation.dispatch(
    StackActions.replace(SendTransactionStackName, {
      entry,
    }),
  );

  return { ok: true, data: paymentUri };
}

function toPaymentAmountInput(rawValue: string | bigint, decimals: number | null): string | null {
  // Payment URIs provide amounts in base units.
  if (typeof decimals !== 'number') {
    return null;
  }

  return new Decimal(String(rawValue)).div(Decimal.pow(10, decimals)).toString();
}

// Map a native transfer URI to the matching send entry.
const navigateNativeTransfer = (params: { paymentUri: PaymentUriPayload; navigation: StackNavigation; tokenAssets: IAsset[] }): PaymentUriParseResult => {
  const { paymentUri, navigation, tokenAssets } = params;

  const nativeAsset = tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native);
  const sendAsset = nativeAsset ? toTransferAssetFromIAsset(nativeAsset) : null;
  const rawValue = paymentUri.params?.value ?? paymentUri.params?.uint256;

  if (!sendAsset) {
    return navigateToSendEntry({
      navigation,
      paymentUri,
      entry: {
        kind: 'recipient',
        recipient: paymentUri.address,
      },
    });
  }

  if (rawValue !== undefined) {
    const amountInput = toPaymentAmountInput(rawValue, sendAsset.decimals);

    if (amountInput === null) {
      return navigateToSendEntry({
        navigation,
        paymentUri,
        entry: {
          kind: 'recipient',
          recipient: paymentUri.address,
        },
      });
    }

    return navigateToSendEntry({
      navigation,
      paymentUri,
      entry: {
        kind: 'review',
        recipient: paymentUri.address,
        asset: sendAsset,
        amountIntent: {
          kind: 'exact',
          amount: amountInput,
        },
      },
    });
  }

  return navigateToSendEntry({
    navigation,
    paymentUri,
    entry: {
      kind: 'asset',
      recipient: paymentUri.address,
      asset: sendAsset,
    },
  });
};

// Map a token transfer URI to the matching send entry.
const navigateTokenTransfer = (params: {
  paymentUri: PaymentUriPayload;
  navigation: StackNavigation;
  tokenAssets: IAsset[];
  t: TFunction;
}): PaymentUriParseResult => {
  const { paymentUri, navigation, tokenAssets, t } = params;

  if (!tokenAssets.length) {
    return navigateToSendEntry({
      navigation,
      paymentUri,
      entry: {
        kind: 'recipient',
        recipient: paymentUri.address,
      },
    });
  }

  const paramAddress = typeof paymentUri.params?.address === 'string' ? paymentUri.params.address : undefined;
  const targetAsset = !paramAddress
    ? tokenAssets.find((asset) => asset.type === ASSET_TYPE.Native)
    : tokenAssets.find((asset) => asset.contractAddress?.toLowerCase() === paramAddress.toLowerCase());

  if (!targetAsset) {
    if (paramAddress) {
      return navigateToSendEntry({
        navigation,
        paymentUri,
        entry: {
          kind: 'recipient',
          recipient: paymentUri.address,
          assetSearchText: paramAddress,
        },
      });
    }
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  const sendAsset = toTransferAssetFromIAsset(targetAsset);
  if (!sendAsset) {
    return navigateToSendEntry({
      navigation,
      paymentUri,
      entry: {
        kind: 'recipient',
        recipient: paymentUri.address,
        assetSearchText: paramAddress,
      },
    });
  }

  const transferValue = paymentUri.params?.uint256 ?? paymentUri.params?.value;
  if (transferValue !== undefined) {
    const amountInput = toPaymentAmountInput(transferValue, sendAsset.decimals);

    if (amountInput === null) {
      return navigateToSendEntry({
        navigation,
        paymentUri,
        entry: {
          kind: 'recipient',
          recipient: paymentUri.address,
          assetSearchText: paramAddress,
        },
      });
    }

    return navigateToSendEntry({
      navigation,
      paymentUri,
      entry: {
        kind: 'review',
        recipient: paymentUri.address,
        asset: sendAsset,
        amountIntent: {
          kind: 'exact',
          amount: amountInput,
        },
      },
    });
  }

  return navigateToSendEntry({
    navigation,
    paymentUri,
    entry: {
      kind: 'asset',
      recipient: paymentUri.address,
      asset: sendAsset,
    },
  });
};

export const routeParsedPaymentUri = (params: {
  paymentUri: PaymentUriPayload;
  assets: IAsset[];
  navigation?: StackNavigation;
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  t: TFunction;
}): PaymentUriParseResult => {
  const { paymentUri, assets, navigation, onConfirm, t } = params;
  const tokenAssets = assets.filter((asset) => asset.type === ASSET_TYPE.Native || asset.type === ASSET_TYPE.ERC20);

  // Inline QR mode handles the parsed payload without navigation.
  if (onConfirm) {
    return { ok: true, data: paymentUri };
  }

  if (!navigation) {
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  if (!paymentUri.method) {
    return navigateNativeTransfer({ paymentUri, navigation, tokenAssets });
  }

  if (paymentUri.method === 'transfer') {
    return navigateTokenTransfer({ paymentUri, navigation, tokenAssets, t });
  }

  return { ok: false, message: t('scan.QRCode.error.notRecognized') };
};
