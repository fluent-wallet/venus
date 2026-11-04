import { NetworkType } from '@core/types';
import { isValidAddress } from '@service/address';
import type { INetwork } from '@service/core';
import { PaymentUriError, type PaymentUriPayload, parsePaymentUri } from '@utils/payment-uri';
import type { TFunction } from 'i18next';
import type { ParseResult, PaymentUriParseResult } from './types';

export type PaymentInputContext = {
  currentNetwork: INetwork | null | undefined;
  t: TFunction;
};

export function parseRawAddress(raw: string, currentNetwork: PaymentInputContext['currentNetwork']): PaymentUriPayload | null {
  if (currentNetwork && isValidAddress({ networkType: currentNetwork.networkType, addressValue: raw })) {
    return { protocol: currentNetwork.networkType === NetworkType.Ethereum ? 'ethereum' : 'conflux', address: raw };
  }
  return null;
}

const validateProtocol = (paymentUri: PaymentUriPayload, currentNetwork: INetwork, t: PaymentInputContext['t']): PaymentUriParseResult | null => {
  const expectedProtocol = currentNetwork.networkType === NetworkType.Conflux ? 'conflux' : 'ethereum';
  if (paymentUri.protocol && paymentUri.protocol !== expectedProtocol) {
    return { ok: false, message: t('scan.parse.error.networkMismatch') };
  }
  return null;
};

const validateChain = (paymentUri: PaymentUriPayload, currentNetwork: INetwork, t: PaymentInputContext['t']): PaymentUriParseResult | null => {
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

const validateRecipientAddress = (address: string, currentNetwork: INetwork, t: PaymentInputContext['t']): PaymentUriParseResult | null => {
  if (!isValidAddress({ networkType: currentNetwork.networkType, addressValue: address })) {
    return { ok: false, message: t('scan.parse.error.invalidTargetAddress') };
  }
  return null;
};

export function parsePaymentUriInput(raw: string, { currentNetwork, t }: PaymentInputContext): PaymentUriParseResult {
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

  return { ok: true, data: paymentUri };
}

export function parseRecipientInput(raw: string, context: PaymentInputContext): ParseResult<string> {
  const addressPaymentUri = parseRawAddress(raw, context.currentNetwork);
  if (addressPaymentUri) return { ok: true, data: addressPaymentUri.address };

  const result = parsePaymentUriInput(raw, context);
  return result.ok ? { ok: true, data: result.data.address } : result;
}
