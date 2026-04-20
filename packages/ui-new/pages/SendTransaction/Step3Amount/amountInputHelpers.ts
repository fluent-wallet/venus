import Decimal from 'decimal.js';

const NETWORK_RELATED_PRECHECK_ERROR_HINTS = ['timed out', 'timeout', 'network', 'failed to fetch', 'fetch failed', 'connection', 'socket', 'econn', 'rpc'];

function getPrecheckErrorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error ?? '');
}

export function getLocalMaxInputAmount(params: { balanceBaseUnits: string; decimals: number; ownedNftAmount?: string | null }): string | null {
  if (params.ownedNftAmount != null) {
    return params.ownedNftAmount;
  }

  try {
    return new Decimal(params.balanceBaseUnits).div(Decimal.pow(10, params.decimals)).toString();
  } catch {
    return null;
  }
}

export function getTransferPrecheckQueryErrorTranslationKey(error: unknown): 'tx.confirm.error.network' | 'tx.amount.error.estimate' {
  const errorMessageText = getPrecheckErrorMessageText(error).toLowerCase();

  return NETWORK_RELATED_PRECHECK_ERROR_HINTS.some((hint) => errorMessageText.includes(hint)) ? 'tx.confirm.error.network' : 'tx.amount.error.estimate';
}
