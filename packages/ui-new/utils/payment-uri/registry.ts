import { type PaymentUriCodec, PaymentUriError, type PaymentUriPayload } from './types';

const codecsById = new Map<string, PaymentUriCodec>();
const codecsByScheme = new Map<string, PaymentUriCodec>();
const codecList: PaymentUriCodec[] = [];

const normalizeScheme = (value: string) => value.trim().toLowerCase();

const extractScheme = (raw: string): string | null => {
  const separatorIndex = raw.indexOf(':');

  if (separatorIndex <= 0) return null;

  return raw.substring(0, separatorIndex);
};

const findSupportingCodec = (raw: string): PaymentUriCodec | undefined => {
  for (const codec of codecList) {
    try {
      if (codec.supports(raw)) return codec;
    } catch (error) {
      // ignore
    }
  }

  return undefined;
};

export function registerCodec(codec: PaymentUriCodec) {
  if (codecsById.has(codec.id)) return;

  codecsById.set(codec.id, codec);
  codecList.push(codec);
  codec.protocols.forEach((scheme) => {
    codecsByScheme.set(normalizeScheme(scheme), codec);
  });
}

export function getCodecById(id: string): PaymentUriCodec | undefined {
  return codecsById.get(id);
}

export function getCodecForProtocol(protocol: string): PaymentUriCodec | undefined {
  return codecsByScheme.get(normalizeScheme(protocol));
}

export function listRegisteredCodecs(): PaymentUriCodec[] {
  return [...codecList];
}
export function parsePaymentUri(raw: string): PaymentUriPayload {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new PaymentUriError('INVALID_URI', 'Payment URI must be a non-empty string.');
  }
  const trimmed = raw.trim();
  const scheme = extractScheme(trimmed);
  let codec: PaymentUriCodec | undefined;
  if (scheme) {
    codec = getCodecForProtocol(scheme);
  }
  if (!codec) {
    codec = findSupportingCodec(trimmed);
  }
  if (!codec) {
    const message = scheme ? `Unsupported payment URI protocol: ${scheme}` : 'Unsupported payment URI protocol.';
    throw new PaymentUriError('UNSUPPORTED_PROTOCOL', message);
  }
  const parsed = codec.parse(trimmed);
  const protocol = parsed.protocol || scheme || codec.protocols[0];
  const metadata = { ...(parsed.metadata ?? {}), codecId: codec.id };
  return { ...parsed, protocol, metadata };
}

export function encodePaymentUri(payload: PaymentUriPayload): string {
  if (!payload || typeof payload !== 'object') {
    throw new PaymentUriError('INVALID_URI', 'Payment URI payload must be an object.');
  }
  if (!payload.protocol || payload.protocol.trim() === '') {
    throw new PaymentUriError('INVALID_URI', 'Payment URI payload requires a protocol.');
  }
  const preferredCodecId = payload.metadata?.codecId;
  let codec: PaymentUriCodec | undefined;
  if (preferredCodecId) {
    codec = getCodecById(preferredCodecId);
  }
  if (!codec) {
    codec = getCodecForProtocol(payload.protocol);
  }
  if (!codec) {
    throw new PaymentUriError('UNSUPPORTED_PROTOCOL', `Unsupported payment URI protocol: ${payload.protocol}`);
  }
  const metadata = { ...(payload.metadata ?? {}), codecId: codec.id };
  return codec.encode({ ...payload, metadata });
}

// test only

export function __resetPaymentUriRegistryForTests(): void {
  codecsById.clear();
  codecsByScheme.clear();
  codecList.splice(0, codecList.length);
}
