import { NetworkType } from '@core/utils/consts';
import { encodeConfluxUri, parseConfluxUri } from './conflux';
import { encodeEthereumUri, parseEthereumUri } from './ethereum';
import { validateAmount } from './params';
import type { PaymentRequest } from './types';

export type { PaymentAsset, PaymentRequest } from './types';

export function parsePaymentUri(raw: string): PaymentRequest {
  const input = raw.trim();
  const separator = input.indexOf(':');
  const scheme = separator === -1 ? '' : input.slice(0, separator).toLowerCase();
  if (scheme === 'ethereum') return parseEthereumUri(input.slice(separator + 1));
  if (/^(?:cfx|cfxtest|net[1-9][0-9]*)$/.test(scheme)) return parseConfluxUri(input);
  throw new Error(`Unsupported payment scheme: ${scheme}`);
}

export function encodePaymentUri(payment: PaymentRequest): string {
  validateAmount(payment.amountBaseUnits);
  switch (payment.networkType) {
    case NetworkType.Ethereum:
      return encodeEthereumUri(payment);
    case NetworkType.Conflux:
      return encodeConfluxUri(payment);
  }
}
