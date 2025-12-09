import { validateCfxAddress } from '@core/utils/address';
import { bigIntToExponential, splitOnce, toPlainString } from '../helpers';
import { type PaymentUriCodec, type PaymentUriCodecParseResult, PaymentUriError, type PaymentUriNetworkHint } from '../types';

const deriveNetworkHint = (prefix: string): PaymentUriNetworkHint | undefined => {
  if (!prefix) return undefined;
  if (prefix === 'cfx') return { netId: '1029', namespace: prefix };
  if (prefix === 'cfxtest') return { netId: '1', namespace: prefix };
  if (prefix.startsWith('net')) {
    const netId = prefix.slice(3);
    return netId ? { netId, namespace: prefix } : { namespace: prefix };
  }
  return { namespace: prefix };
};

const prefixFromAddress = (address: string): string => {
  const index = address.indexOf(':');
  return index === -1 ? '' : address.slice(0, index);
};

const parseConfluxUri = (raw: string): PaymentUriCodecParseResult => {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  let offset: number;
  if (lower.startsWith('cfxtest:')) {
    offset = 'cfxtest:'.length;
  } else if (lower.startsWith('cfx:')) {
    offset = 'cfx:'.length;
  } else {
    throw new PaymentUriError('INVALID_URI', 'Conflux URI must start with cfx: or cfxtest:.');
  }

  const [pathPart, queryString] = splitOnce(trimmed.slice(offset), '?');
  const [addressSegment, methodSegment] = splitOnce(pathPart, '/');
  const base32Address = `${trimmed.slice(0, offset)}${addressSegment}`;

  if (!validateCfxAddress(base32Address)) {
    throw new PaymentUriError('INVALID_URI', 'Address is not a valid Conflux Core Space base32 address.');
  }

  const networkPrefix = prefixFromAddress(base32Address);
  const network = deriveNetworkHint(networkPrefix);
  const method = methodSegment ? decodeURIComponent(methodSegment) : undefined;

  const params = queryString ? new URLSearchParams(queryString) : undefined;
  let normalizedParams: PaymentUriCodecParseResult['params'];

  params?.forEach((value, key) => {
    if (!normalizedParams) normalizedParams = {};
    if (key === 'value' || key === 'uint256') {
      normalizedParams[key] = BigInt(toPlainString(value));
    } else {
      normalizedParams[key] = value;
    }
  });

  return {
    protocol: 'conflux',
    address: base32Address,
    network,
    method,
    params: normalizedParams,
  };
};

const encodeConfluxUri = (payload: PaymentUriCodecParseResult): string => {
  if (!payload.address) {
    throw new PaymentUriError('INVALID_URI', 'Conflux URI encoding requires an address.');
  }

  const normalizedAddress = payload.address.trim();
  if (!validateCfxAddress(normalizedAddress)) {
    throw new PaymentUriError('INVALID_URI', 'Address is not a valid Conflux Core Space base32 address.');
  }

  const query = new URLSearchParams();
  if (payload.params) {
    Object.entries(payload.params)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (typeof value === 'bigint') {
          query.set(key, bigIntToExponential(value));
        } else {
          query.set(key, value.toString());
        }
      });
  }

  const queryString = query.toString();
  const methodPart = payload.method ? `/${encodeURIComponent(payload.method)}` : '';
  return `${normalizedAddress}${methodPart}${queryString ? `?${queryString}` : ''}`;
};

export const confluxCorePaymentUriCodec: PaymentUriCodec = {
  id: 'conflux-core',
  protocols: ['conflux', 'cfx', 'cfxtest'],
  supports: (raw: string) => {
    const lower = raw.trim().toLowerCase();
    return lower.startsWith('cfx:') || lower.startsWith('cfxtest:');
  },
  parse: parseConfluxUri,
  encode: encodeConfluxUri,
};
