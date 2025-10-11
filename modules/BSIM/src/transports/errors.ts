export const TransportErrorCode = {
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
  CHANNEL_ALREADY_OPEN: 'CHANNEL_ALREADY_OPEN',
  CHANNEL_NOT_OPEN: 'CHANNEL_NOT_OPEN',
  CHANNEL_OPEN_FAILED: 'CHANNEL_OPEN_FAILED',
  CHANNEL_CLOSE_FAILED: 'CHANNEL_CLOSE_FAILED',
  TRANSMIT_FAILED: 'TRANSMIT_FAILED',
  INVALID_APDU_PAYLOAD: 'INVALID_APDU_PAYLOAD',
  SELECT_AID_FAILED: 'SELECT_AID_FAILED',
} as const;

export type TransportErrorCode = (typeof TransportErrorCode)[keyof typeof TransportErrorCode];

export type TransportErrorDetails = {
  nativeCode?: string;
};

export class TransportError extends Error {
  readonly code: TransportErrorCode;
  readonly details?: TransportErrorDetails;
  readonly cause?: unknown;

  constructor(code: TransportErrorCode, message?: string, options?: { details?: TransportErrorDetails; cause?: unknown }) {
    super(message ?? code);
    this.name = 'TransportError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export const isTransportError = (value: unknown): value is TransportError => value instanceof TransportError;

export const wrapNativeError = (code: TransportErrorCode, error: unknown, fallback: string): TransportError => {
  if (error instanceof TransportError) {
    return error;
  }

  const nativeCode = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : undefined;
  const message = typeof (error as { message?: unknown })?.message === 'string' ? (error as { message: string }).message : fallback;

  return new TransportError(code, message, {
    cause: error,
    details: nativeCode ? { nativeCode } : undefined,
  });
};
