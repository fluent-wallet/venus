import { maxUint256 } from '@core/utils/number';
import Decimal from 'decimal.js';

export function readUri(input: string): { path: string; params: URLSearchParams } {
  if (input.includes('#')) throw new Error('Payment URIs cannot contain fragments.');

  const queryStart = input.indexOf('?');
  const path = queryStart === -1 ? input : input.slice(0, queryStart);
  const query = queryStart === -1 ? '' : input.slice(queryStart + 1);
  // URI query parameters preserve plus signs; form decoding would turn them into spaces.
  const params = new URLSearchParams(query.replace(/\+/g, '%2B'));
  const keys = new Set<string>();
  params.forEach((_value, key) => {
    if (keys.has(key)) throw new Error('Duplicate payment parameters.');
    keys.add(key);
  });

  return { path, params };
}

export function readAmount(value: string | null): bigint | undefined {
  if (value === null) return undefined;

  const amount = new Decimal(value);
  if (!amount.isFinite() || !amount.isInteger() || amount.isNegative() || amount.greaterThan(maxUint256.toString())) {
    throw new Error('Payment amount must be an unsigned 256-bit integer.');
  }
  return BigInt(amount.toFixed());
}

export function validateAmount(amount: bigint | undefined): void {
  if (amount !== undefined && (amount < 0n || amount > maxUint256)) {
    throw new Error('Payment amount must be an unsigned 256-bit integer.');
  }
}

export function formatParams(values: Record<string, string | bigint | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, value.toString());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
