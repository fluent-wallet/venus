import { CoreError, TX_INVALID_PARAMS, TX_SIGN_ADDRESS_MISMATCH } from '@core/errors';
import { AssetType, type EvmRpcTransactionRequest, type Hex } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import * as OxHex from 'ox/Hex';
import type { FeeFields, ReviewDappTransactionResult, ReviewError, TransactionReviewOverride } from '../../stagedTypes';
import type { TransactionHandlers } from '../types';
import { buildEvmUnsignedTransaction, buildPresetOptions, getFeeUnitPrice, parseRpcQuantityToNumber, pickFee, toDisplayAmount } from './shared';
import type { EvmHandlerDeps } from './types';

function getDappRequestFeeFields(params: {
  request: EvmRpcTransactionRequest;
  estimate: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  requestType?: number;
}): FeeFields | null {
  const { request, estimate, requestType } = params;

  const build1559FeeFields = (): FeeFields | null => {
    const maxFeePerGas = request.maxFeePerGas ?? estimate.maxFeePerGas ?? estimate.gasPrice;
    const maxPriorityFeePerGas = request.maxPriorityFeePerGas ?? estimate.maxPriorityFeePerGas;

    if (typeof maxFeePerGas !== 'string' || typeof maxPriorityFeePerGas !== 'string') {
      return null;
    }

    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  };

  if (requestType === 0 || requestType === 1) {
    return typeof request.gasPrice === 'string'
      ? {
          gasPrice: request.gasPrice,
        }
      : null;
  }

  if (requestType === 2) {
    return build1559FeeFields();
  }

  if (typeof request.maxFeePerGas === 'string' || typeof request.maxPriorityFeePerGas === 'string') {
    return build1559FeeFields();
  }

  if (typeof request.gasPrice === 'string') {
    return {
      gasPrice: request.gasPrice,
    };
  }

  return null;
}

function buildPreparedDappRequest(params: {
  executionRequest: {
    from: string;
    to?: string;
    value: Hex;
    data: Hex;
  };
  gasLimit: string;
  nonce: number;
  feeFields: FeeFields;
  type: number;
}): EvmRpcTransactionRequest {
  return {
    from: params.executionRequest.from,
    to: params.executionRequest.to,
    value: params.executionRequest.value,
    data: params.executionRequest.data,
    gas: params.gasLimit as Hex,
    nonce: OxHex.fromNumber(BigInt(params.nonce)) as Hex,
    type: OxHex.fromNumber(BigInt(params.type)) as Hex,
    ...('gasPrice' in params.feeFields
      ? {
          gasPrice: params.feeFields.gasPrice as Hex,
        }
      : {
          maxFeePerGas: params.feeFields.maxFeePerGas as Hex,
          maxPriorityFeePerGas: params.feeFields.maxPriorityFeePerGas as Hex,
        }),
  };
}

function buildDappErrorResult(error: ReviewError): ReviewDappTransactionResult {
  return {
    summary: null,
    fee: null,
    presetOptions: [],
    error: { ...error },
    canSubmit: false,
    prepared: null,
  };
}

function assertOptionalHexQuantity(value: string | undefined, field: string) {
  if (value == null) return;
  if (/^0x[0-9a-fA-F]+$/.test(value)) return;

  throw new CoreError({
    code: TX_INVALID_PARAMS,
    message: 'Invalid JSON-RPC params.',
    context: { reason: `${field} must be a hex quantity string (0x...).` },
  });
}

function assertOptionalHexBytes(value: string | undefined, field: string) {
  if (value == null) return;
  if (value.length % 2 === 0 && /^0x[0-9a-fA-F]*$/.test(value)) return;

  throw new CoreError({
    code: TX_INVALID_PARAMS,
    message: 'Invalid JSON-RPC params.',
    context: { reason: `${field} must be a hex data string (0x...).` },
  });
}

export function createReviewDappTransactionHandler({ ctx, chainProvider }: EvmHandlerDeps): TransactionHandlers['reviewDappTransaction'] {
  return async ({ address, request }) => {
    const currentAddressValue = (await address.getValue()).toLowerCase();

    if (request.request.from.toLowerCase() !== currentAddressValue) {
      throw new CoreError({
        code: TX_SIGN_ADDRESS_MISMATCH,
        message: 'reviewDappTransaction address mismatch.',
        context: {
          expectedFrom: currentAddressValue,
          from: request.request.from,
        },
      });
    }

    if (request.request.to && !chainProvider.validateAddress(request.request.to)) {
      return buildDappErrorResult({
        code: 'invalid_recipient',
        message: 'The recipient address is invalid.',
      });
    }

    assertOptionalHexQuantity(request.request.value, 'value');
    assertOptionalHexQuantity(request.request.gas, 'gas');
    assertOptionalHexQuantity(request.request.gasPrice, 'gasPrice');
    assertOptionalHexQuantity(request.request.maxFeePerGas, 'maxFeePerGas');
    assertOptionalHexQuantity(request.request.maxPriorityFeePerGas, 'maxPriorityFeePerGas');
    assertOptionalHexQuantity(request.request.nonce, 'nonce');
    assertOptionalHexQuantity(request.request.type, 'type');
    assertOptionalHexBytes(request.request.data, 'data');

    const requestType = parseRpcQuantityToNumber(request.request.type, 'type');
    const nonce = request.override?.nonce ?? parseRpcQuantityToNumber(request.request.nonce, 'nonce') ?? (await chainProvider.getNonce(request.request.from));
    const executionRequest: {
      from: string;
      to?: string;
      chainId: string;
      value: Hex;
      data: Hex;
    } = {
      from: request.request.from,
      to: request.request.to,
      chainId: ctx.network.chainId,
      value: request.request.value ?? '0x0',
      data: request.request.data ?? '0x',
    };

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Ethereum,
      payload: {
        ...executionRequest,
        gasLimit: request.override?.gasLimit ?? request.request.gas,
        gasPrice: request.request.gasPrice,
        maxFeePerGas: request.request.maxFeePerGas,
        maxPriorityFeePerGas: request.request.maxPriorityFeePerGas,
        nonce,
        type: requestType,
      },
    });

    const gasLimit = request.override?.gasLimit ?? request.request.gas ?? estimate.gasLimit;
    const presetOptions = buildPresetOptions({
      gasLimit,
      gasPrice: estimate.gasPrice,
      maxFeePerGas: estimate.maxFeePerGas,
      maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
    });

    const requestFeeFields = getDappRequestFeeFields({
      request: request.request,
      estimate,
      requestType,
    });
    let feeOverride: TransactionReviewOverride | undefined = request.override;
    if (feeOverride?.feeSelection == null && requestFeeFields) {
      feeOverride = {
        ...(request.override ?? {}),
        feeSelection: {
          kind: 'custom',
          fee: requestFeeFields,
        },
      };
    }

    const { selection, fields } = pickFee(presetOptions, feeOverride);
    const gasCost = getFeeUnitPrice(fields) * BigInt(gasLimit);

    const nativeBalances = await chainProvider.readFungibleAssetBalances(request.request.from, [{ assetType: AssetType.Native }]);
    const nativeBalance = BigInt(nativeBalances[0] ?? '0x0');
    const transferValue = BigInt(executionRequest.value);

    const error =
      nativeBalance < transferValue + gasCost
        ? ({
            code: 'insufficient_native_for_fee',
            message: transferValue > 0n ? 'Insufficient native balance.' : 'Insufficient native balance for gas.',
          } as const)
        : null;

    const type = requestType === 1 ? 1 : 'gasPrice' in fields ? 0 : 2;
    const preparedRequest = buildPreparedDappRequest({
      executionRequest,
      gasLimit,
      nonce,
      feeFields: fields,
      type,
    });

    return {
      summary: {
        request: preparedRequest,
        fee: {
          payableGasFee: toDisplayAmount(gasCost, 18),
        },
      },
      fee: {
        selection,
        fields,
        gasLimit,
        nonce,
      },
      presetOptions,
      error,
      canSubmit: !error,
      prepared: error
        ? null
        : {
            preparedKind: 'dapp',
            addressId: address.id,
            networkType: ctx.network.networkType,
            request: preparedRequest,
            app: request.app ?? null,
            fee: {
              fields,
              gasLimit,
              nonce,
              type,
            },
            executionRequest,
          },
    };
  };
}

export const buildDappUnsignedTransaction: TransactionHandlers['buildDappUnsignedTransaction'] = async (prepared) =>
  buildEvmUnsignedTransaction({
    executionRequest: prepared.executionRequest,
    fee: prepared.fee,
  });
