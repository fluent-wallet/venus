export type PaymentUriParams = Record<string, string | bigint>;

export interface PaymentUriNetworkHint {
  chainId?: string;
  netId?: string;
  namespace?: string;
  [key: string]: unknown;
}

export interface PaymentUriMetadata extends Record<string, unknown> {
  codecId?: string;
}

export interface PaymentUriPayload {
  protocol: string;
  address: string;
  network?: PaymentUriNetworkHint;
  method?: string;
  params?: PaymentUriParams;
  metadata?: PaymentUriMetadata;
}

export type PaymentUriCodecParseResult<TMetadata extends PaymentUriMetadata = PaymentUriMetadata> = PaymentUriPayload & { metadata?: TMetadata };

export interface PaymentUriCodec<TMetadata extends PaymentUriMetadata = PaymentUriMetadata> {
  id: string;
  protocols: string[];
  supports(raw: string): boolean;
  parse(raw: string): PaymentUriCodecParseResult<TMetadata>;
  encode(payload: PaymentUriCodecParseResult<TMetadata>): string;
}

export type PaymentUriErrorCode = 'INVALID_URI' | 'UNSUPPORTED_PROTOCOL' | 'ENCODE_FAILED';

export class PaymentUriError extends Error {
  readonly code: PaymentUriErrorCode;

  constructor(code: PaymentUriErrorCode, message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.name = 'PaymentUriError';
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
