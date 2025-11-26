import type { PaymentUriPayload } from '@utils/payment-uri';

export type ParseResult<T> = { ok: true; data: T } | { ok: false; message: string; blocking?: boolean; type?: string };

export type PaymentUriParseResult = ParseResult<PaymentUriPayload>;
