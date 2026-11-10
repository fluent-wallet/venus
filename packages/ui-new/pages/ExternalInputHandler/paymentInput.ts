import { NetworkType } from '@core/types';
import { validateHexAddress } from '@core/utils/address';
import type { INetwork } from '@service/core';
import { type PaymentRequest, parsePaymentUri } from '@utils/payment-uri';
import type { TFunction } from 'i18next';
import type { ParseResult, PaymentUriParseResult } from './types';

export type PaymentInputContext = {
  currentNetwork: INetwork | null | undefined;
  t: TFunction;
};

export function parsePaymentUriInput(raw: string, { currentNetwork, t }: PaymentInputContext): PaymentUriParseResult {
  if (!currentNetwork) {
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  let payment: PaymentRequest;
  try {
    const input = raw.trim();
    // Bare EVM addresses have no URI prefix or payment details, so use the current network's native asset.
    if (currentNetwork.networkType === NetworkType.Ethereum && validateHexAddress(input)) {
      payment = {
        networkType: NetworkType.Ethereum,
        recipientAddress: input,
        asset: { type: 'native' },
      };
    } else {
      // Core addresses include a network prefix and can go through the URI parser directly.
      payment = parsePaymentUri(input);
    }
  } catch {
    return { ok: false, message: t('scan.QRCode.error.notRecognized') };
  }

  if (payment.networkType !== currentNetwork.networkType) {
    return { ok: false, message: t('scan.parse.error.networkMismatch') };
  }
  if (payment.chainId !== undefined && payment.chainId !== BigInt(currentNetwork.chainId)) {
    return { ok: false, message: t('scan.parse.error.missChianId') };
  }

  return { ok: true, data: payment };
}

export function parseRecipientInput(raw: string, context: PaymentInputContext): ParseResult<string> {
  const result = parsePaymentUriInput(raw, context);
  return result.ok ? { ok: true, data: result.data.recipientAddress } : result;
}
