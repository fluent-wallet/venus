import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { AssetType, NetworkType, getAssetsTokenList } from '@core/WalletCore/Plugins/ReactInject';
import { WalletConnectPluginError } from '@core/WalletCore/Plugins/WalletConnect';
import { parsePaymentUri, PaymentUriError, type PaymentUriPayload } from '@utils/payment-uri';
import { StackActions } from '@react-navigation/native';
import Decimal from 'decimal.js';
import {
  SendTransactionStackName,
  SendTransactionStep2StackName,
  SendTransactionStep3StackName,
  SendTransactionStep4StackName,
  type StackNavigation,
} from '@router/configs';
import type { PaymentUriParseResult } from './types';
import type { Network } from '@core/database/models/Network';
import type { TFunction } from 'i18next';

type ParserDeps = {
  currentNetwork: Network;
  navigation?: StackNavigation;
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  t: TFunction;
  setStatus: (status: PaymentUriParseResult | null) => void;
};

// Ensure the scanned protocol matches current network
const validateProtocol = (paymentUri: PaymentUriPayload, currentNetwork: Network, t: ParserDeps['t']): PaymentUriParseResult | null => {
  const expectedProtocol = currentNetwork.networkType === NetworkType.Conflux ? 'conflux' : 'ethereum';
  if (paymentUri.protocol && paymentUri.protocol !== expectedProtocol) {
    return { ok: false, message: t('scan.parse.error.networkMismatch') };
  }
  return null;
};

// Ensure chain id/namespace matches current network
const validateChain = (paymentUri: PaymentUriPayload, currentNetwork: Network, t: ParserDeps['t']): PaymentUriParseResult | null => {
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
const validateRecipientAddress = async (address: string, currentNetwork: Network, t: ParserDeps['t']): Promise<PaymentUriParseResult | null> => {
  const isValid = await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: address });
  if (!isValid) {
    return { ok: false, message: t('scan.parse.error.invalidTargetAddress') };
  }
  return null;
};

// Navigate native transfer flow
const navigateNativeTransfer = (paymentUri: PaymentUriPayload, navigation: StackNavigation | undefined, t: ParserDeps['t']): PaymentUriParseResult => {
  if (!navigation) return { ok: false, message: t('scan.QRCode.error.notRecognized') };

  const nativeAsset = getAssetsTokenList()?.find((asset) => asset.type === AssetType.Native);
  const rawValue = paymentUri.params?.value ?? paymentUri.params?.uint256;

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
const navigateTokenTransfer = (paymentUri: PaymentUriPayload, navigation: StackNavigation | undefined, t: ParserDeps['t']): PaymentUriParseResult => {
  if (!navigation) return { ok: false, message: t('scan.QRCode.error.notRecognized') };

  const allAssetsTokens = getAssetsTokenList();
  if (!allAssetsTokens?.length) {
    navigation.dispatch(
      StackActions.replace(SendTransactionStackName, { screen: SendTransactionStep2StackName, params: { recipientAddress: paymentUri.address } }),
    );
    return { ok: true, data: paymentUri };
  }

  const paramAddress = typeof paymentUri.params?.address === 'string' ? paymentUri.params.address : undefined;
  const targetAsset = !paramAddress
    ? allAssetsTokens.find((asset) => asset.type === AssetType.Native)
    : allAssetsTokens.find((asset) => asset.contractAddress?.toLowerCase() === paramAddress.toLowerCase());

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
  const { currentNetwork, onConfirm, navigation, t, setStatus } = deps;

  // Raw address
  if (await methods.checkIsValidAddress({ networkType: currentNetwork.networkType, addressValue: raw })) {
    return { ok: true, data: { protocol: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum' : 'conflux', address: raw } };
  }

  // WalletConnect URI
  if (!onConfirm && (raw.startsWith('wc:') || raw.startsWith('wc?'))) {
    setStatus({ ok: false, blocking: true, type: 'connecting-wc', message: t('wc.connecting') });

    const timeoutId = setTimeout(() => {
      setStatus({ ok: false, blocking: false, type: 'wc-timeout', message: t('scan.walletConnect.error.timeout') });
    }, 12888);

    try {
      if (raw.startsWith('wc:')) {
        await plugins.WalletConnect.connect({ wcURI: raw });
      }
      clearTimeout(timeoutId);
      return { ok: false, blocking: true, type: 'connecting-wc', message: t('wc.connecting') };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof WalletConnectPluginError) {
        if (err.message === 'VersionNotSupported') {
          return { ok: false, message: t('scan.walletConnect.error.lowVersion') };
        }
        if (err.message === 'PairingAlreadyExists') {
          return { ok: false, message: t('scan.walletConnect.error.pairingAlreadyExists') };
        }
        return { ok: false, message: `${t('scan.walletConnect.error.connectFailed')} ${String(err ?? '')}` };
      }
      return { ok: false, message: t('scan.QRCode.error.notRecognized') };
    }
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

  const addrErr = await validateRecipientAddress(paymentUri.address, currentNetwork, t);
  if (addrErr) return addrErr;

  // inline mode: return payload directly, let QrScannerSheet handle onConfirm
  if (onConfirm) {
    return { ok: true, data: paymentUri };
  }

  if (!paymentUri.method) {
    return navigateNativeTransfer(paymentUri, navigation, t);
  }

  if (paymentUri.method === 'transfer') {
    return navigateTokenTransfer(paymentUri, navigation, t);
  }

  return { ok: false, message: t('scan.QRCode.error.notRecognized') };
};
