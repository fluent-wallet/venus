import { isAddress } from 'ethers';
import { bigIntToExponential, splitOnce, toPlainString } from '../helpers';
import { type PaymentUriCodec, type PaymentUriCodecParseResult, PaymentUriError } from '../types';

// https://eips.ethereum.org/EIPS/eip-681

type EthereumMetadata = {
  payPrefix?: boolean;
};

const parseEthereumUri = (raw: string): PaymentUriCodecParseResult<EthereumMetadata> => {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('ethereum:')) {
    throw new PaymentUriError('INVALID_URI', 'Ethereum URI must use the "ethereum" scheme.');
  }

  const schemeEnd = trimmed.indexOf(':') + 1;
  const afterScheme = trimmed.slice(schemeEnd);

  const [pathPart, queryString] = splitOnce(afterScheme, '?');
  const [baseSegment, methodSegment] = splitOnce(pathPart, '/');

  const hasPayPrefix = baseSegment.startsWith('pay-');
  const remaining = hasPayPrefix ? baseSegment.slice(4) : baseSegment;
  const [addressSegment, chainSegment] = splitOnce(remaining, '@');

  if (!isAddress(addressSegment)) {
    throw new PaymentUriError('INVALID_URI', 'Address is not a valid Ethereum address.');
  }

  const params = queryString ? new URLSearchParams(queryString) : undefined;
  let normalizedParams: PaymentUriCodecParseResult<EthereumMetadata>['params'];

  params?.forEach((value, key) => {
    if (!normalizedParams) normalizedParams = {};
    if (key === 'value' || key === 'uint256') {
      normalizedParams[key] = BigInt(toPlainString(value));
    } else {
      normalizedParams[key] = value;
    }
  });

  return {
    protocol: 'ethereum',
    address: addressSegment,
    network: chainSegment ? { chainId: chainSegment } : undefined,
    method: methodSegment || undefined,
    params: normalizedParams,
    metadata: hasPayPrefix ? { payPrefix: true } : undefined,
  };
};

const encodeEthereumUri = (payload: PaymentUriCodecParseResult<EthereumMetadata>): string => {
  if (!payload.address) {
    throw new PaymentUriError('INVALID_URI', 'Ethereum URI encoding requires an address.');
  }
  if (!isAddress(payload.address)) {
    throw new PaymentUriError('INVALID_URI', 'Address is not a valid Ethereum address.');
  }

  const scheme = 'ethereum';
  const payPrefix = payload.metadata?.payPrefix ? 'pay-' : '';
  const chainPart = payload.network?.chainId ? `@${payload.network.chainId}` : '';
  const methodPart = payload.method ? `/${payload.method}` : '';

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
  return `${scheme}:${payPrefix}${payload.address}${chainPart}${methodPart}${queryString ? `?${queryString}` : ''}`;
};

export const ethereumPaymentUriCodec: PaymentUriCodec<EthereumMetadata> = {
  id: 'ethereum',
  protocols: ['ethereum'],
  supports: (raw: string) => raw.trim().toLowerCase().startsWith('ethereum:'),
  parse: parseEthereumUri,
  encode: encodeEthereumUri,
};
