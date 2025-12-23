import { CoreError, TX_INVALID_PARAMS } from '@core/errors';
import type { Address, Hex } from '@core/types';
import { validate as isEvmAddress } from 'ox/Address';
import type { EvmSignableMessage, EvmSignMessageParameters, EvmSignTypedDataParameters, EvmTypedDataV4 } from './dappTypes';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isHexBytes = (value: string): value is Hex => value.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(value);

const parseRpcParamsArray = (params: unknown): unknown[] => {
  if (Array.isArray(params)) return params;
  throw new CoreError({
    code: TX_INVALID_PARAMS,
    message: 'Invalid JSON-RPC params.',
    context: { reason: 'Params must be an array.' },
  });
};

const pickAddressAndPayload = (params: unknown[]): { from: Address; payload: unknown } => {
  if (params.length < 2) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid JSON-RPC params.',
      context: { reason: 'Expected at least 2 parameters.' },
    });
  }

  const first = params[0];
  const second = params[1];

  const firstIsAddress = typeof first === 'string' && isEvmAddress(first, { strict: false });
  const secondIsAddress = typeof second === 'string' && isEvmAddress(second, { strict: false });

  if (firstIsAddress && !secondIsAddress) return { from: first, payload: second };
  if (secondIsAddress && !firstIsAddress) return { from: second, payload: first };

  throw new CoreError({
    code: TX_INVALID_PARAMS,
    message: 'Invalid JSON-RPC params.',
    context: { reason: 'Expected exactly one EVM address among the first two parameters.' },
  });
};

const toSignableMessage = (value: unknown): EvmSignableMessage => {
  if (typeof value === 'string') {
    return isHexBytes(value) ? { raw: value } : value;
  }

  if (isPlainObject(value) && typeof value.raw === 'string' && isHexBytes(value.raw)) {
    return { raw: value.raw };
  }

  throw new CoreError({
    code: TX_INVALID_PARAMS,
    message: 'Invalid personal_sign params.',
    context: { reason: 'Message must be a string or { raw: 0x... }.' },
  });
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid JSON in typed data params.',
      cause: error,
    });
  }
};

const parseTypedDataV4 = (value: unknown): EvmTypedDataV4 => {
  const raw = typeof value === 'string' ? parseJson(value) : value;

  if (!isPlainObject(raw)) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid typed data params.',
      context: { reason: 'Typed data must be an object or JSON string.' },
    });
  }

  const domain = raw.domain;
  const types = raw.types;
  const message = raw.message;
  const primaryType = raw.primaryType;

  if (!isPlainObject(domain) || !isPlainObject(types) || !isPlainObject(message)) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid typed data params.',
      context: { reason: 'Typed data must include domain/types/message objects.' },
    });
  }

  if (primaryType !== undefined && typeof primaryType !== 'string') {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid typed data params.',
      context: { reason: 'primaryType must be a string when provided.' },
    });
  }

  return {
    domain: domain as EvmTypedDataV4['domain'],
    types: types as EvmTypedDataV4['types'],
    message: message as EvmTypedDataV4['message'],
    primaryType: primaryType as EvmTypedDataV4['primaryType'],
  };
};

export const parseSignMessageParameters = (params: unknown): EvmSignMessageParameters => {
  const list = parseRpcParamsArray(params);
  const { from, payload } = pickAddressAndPayload(list);
  return { from, message: toSignableMessage(payload) };
};
export const parseSignTypedDataParameters = (params: unknown): EvmSignTypedDataParameters => {
  const list = parseRpcParamsArray(params);
  const { from, payload } = pickAddressAndPayload(list);
  return { from, typedData: parseTypedDataV4(payload) };
};
