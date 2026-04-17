import { CoreError, TX_INVALID_PARAMS, TX_SIGN_ADDRESS_MISMATCH } from '@core/errors';
import { AssetType, type ConfluxChainProviderLike, type ConfluxUnsignedTransaction, type Hex } from '@core/types';
import { decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import * as OxHex from 'ox/Hex';
import type { DappTransactionRequest } from '../../dappTypes';
import type { FeeFields, ReviewDappTransactionResult, ReviewError, TransactionReviewOverride } from '../../stagedTypes';
import { buildPresetOptions, getFeeUnitPrice, parseRpcQuantityToNumber, pickFee, toDisplayAmount } from '../evm/shared';
import type { TransactionHandlers } from '../types';
import { FIXED_NATIVE_TRANSFER_GAS_LIMIT, FIXED_NATIVE_TRANSFER_STORAGE_LIMIT, getStorageCollateralDrip } from './shared';

type ConfluxExecutionTarget = {
  kind: 'user' | 'contract' | 'builtin';
  address: string;
};

function getDappRequestFeeFields(params: {
  request: DappTransactionRequest;
  estimate: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  requestType?: number;
}): FeeFields | null {
  const { request, estimate, requestType } = params;

  const build1559FeeFields = (): FeeFields | null => {
    const shorthand1559Fee = requestType === 2 ? request.gasPrice : undefined;
    const maxFeePerGas = request.maxFeePerGas ?? shorthand1559Fee ?? estimate.maxFeePerGas ?? estimate.gasPrice;
    const maxPriorityFeePerGas = request.maxPriorityFeePerGas ?? shorthand1559Fee ?? estimate.maxPriorityFeePerGas ?? estimate.gasPrice;

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
  storageLimit: string;
  nonce: number;
  feeFields: FeeFields;
  type: number;
}): DappTransactionRequest {
  return {
    from: params.executionRequest.from,
    to: params.executionRequest.to,
    value: params.executionRequest.value,
    data: params.executionRequest.data,
    gas: params.gasLimit as Hex,
    storageLimit: params.storageLimit as Hex,
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

function resolveConfluxExecutionTarget(to?: string): ConfluxExecutionTarget | null {
  if (!to) return null;

  try {
    const type = decode(to).type;
    if (type === 'user' || type === 'contract' || type === 'builtin') {
      return { kind: type, address: to };
    }
    return null;
  } catch {
    return null;
  }
}

async function resolvePayableDappFeeState(params: {
  chainProvider: ConfluxChainProviderLike;
  from: string;
  executionTarget: ConfluxExecutionTarget | null;
  gasLimit: string;
  storageLimit: string;
  feeFields: FeeFields;
}): Promise<
  | {
      payableGasFee: bigint;
      payableStorageCollateral: bigint;
    }
  | {
      error: ReviewError;
    }
> {
  const feeUnitPrice = getFeeUnitPrice(params.feeFields);
  const gasFee = feeUnitPrice * BigInt(params.gasLimit);
  const storageCollateral = getStorageCollateralDrip(params.storageLimit);

  if (params.executionTarget?.kind !== 'contract') {
    return {
      payableGasFee: gasFee,
      payableStorageCollateral: storageCollateral,
    };
  }

  try {
    const response = (await params.chainProvider.rpc.request('cfx_checkBalanceAgainstTransaction', [
      params.from,
      params.executionTarget.address,
      params.gasLimit,
      OxHex.fromNumber(feeUnitPrice),
      params.storageLimit,
      'latest_state',
    ])) as {
      willPayCollateral?: boolean;
      willPayTxFee?: boolean;
    };

    const willPayCollateral = response?.willPayCollateral !== false;
    const willPayTxFee = response?.willPayTxFee !== false;

    return {
      payableGasFee: willPayTxFee ? gasFee : 0n,
      payableStorageCollateral: willPayCollateral ? storageCollateral : 0n,
    };
  } catch {
    return {
      error: {
        code: 'sponsor_check_failed',
        message: 'Failed to check sponsor state.',
      },
    };
  }
}

export function createReviewDappTransactionHandler(params: {
  ctx: { network: { chainId: string; networkType: NetworkType } };
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['reviewDappTransaction'] {
  const { ctx, chainProvider } = params;

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
    assertOptionalHexQuantity(request.request.storageLimit, 'storageLimit');
    assertOptionalHexBytes(request.request.data, 'data');

    const requestType = parseRpcQuantityToNumber(request.request.type, 'type');
    const nonce = request.override?.nonce ?? parseRpcQuantityToNumber(request.request.nonce, 'nonce') ?? (await chainProvider.getNonce(request.request.from));
    const executionRequest = {
      from: request.request.from,
      to: request.request.to,
      chainId: ctx.network.chainId,
      value: request.request.value ?? ('0x0' as Hex),
      data: request.request.data ?? ('0x' as Hex),
    };

    if (!executionRequest.to && executionRequest.data === '0x') {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Invalid JSON-RPC params.',
        context: { reason: 'to or data is required.' },
      });
    }

    const executionTarget = resolveConfluxExecutionTarget(executionRequest.to);
    if (executionRequest.to && !executionTarget) {
      return buildDappErrorResult({
        code: 'invalid_recipient',
        message: 'The recipient address is invalid.',
      });
    }

    const isSimpleNativeUserTransfer = executionTarget?.kind === 'user' && executionRequest.data === '0x';
    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Conflux,
      payload: {
        ...executionRequest,
        gasLimit: request.override?.gasLimit ?? request.request.gas ?? (isSimpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_GAS_LIMIT : undefined),
        storageLimit:
          request.override?.storageLimit ?? request.request.storageLimit ?? (isSimpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_STORAGE_LIMIT : undefined),
        gasPrice: request.request.gasPrice,
        maxFeePerGas: request.request.maxFeePerGas,
        maxPriorityFeePerGas: request.request.maxPriorityFeePerGas,
        nonce,
        type: requestType,
      },
    });

    const gasLimit = request.override?.gasLimit ?? request.request.gas ?? (isSimpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_GAS_LIMIT : estimate.gasLimit);
    const storageLimit =
      request.override?.storageLimit ??
      request.request.storageLimit ??
      (isSimpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_STORAGE_LIMIT : estimate.storageLimit);

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
    const payableFeeState = await resolvePayableDappFeeState({
      chainProvider,
      from: request.request.from,
      executionTarget,
      gasLimit,
      storageLimit,
      feeFields: fields,
    });

    if ('error' in payableFeeState) {
      return buildDappErrorResult(payableFeeState.error);
    }

    const nativeBalances = await chainProvider.readFungibleAssetBalances(request.request.from, [{ assetType: AssetType.Native }]);
    const nativeBalance = BigInt(nativeBalances[0] ?? '0x0');
    const requiredNative = BigInt(executionRequest.value) + payableFeeState.payableGasFee + payableFeeState.payableStorageCollateral;

    const error =
      nativeBalance < requiredNative
        ? ({
            code: 'insufficient_native_for_fee',
            message: executionRequest.value === '0x0' ? 'Insufficient native balance for fee.' : 'Insufficient native balance.',
          } as const)
        : null;

    const type = requestType === 1 ? 1 : 'gasPrice' in fields ? 0 : 2;
    const preparedRequest = buildPreparedDappRequest({
      executionRequest,
      gasLimit,
      storageLimit,
      nonce,
      feeFields: fields,
      type,
    });

    return {
      summary: {
        request: preparedRequest,
        fee: {
          payableGasFee: toDisplayAmount(payableFeeState.payableGasFee, 18),
          payableStorageCollateral: toDisplayAmount(payableFeeState.payableStorageCollateral, 18),
        },
      },
      fee: {
        selection,
        fields,
        gasLimit,
        storageLimit,
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
              storageLimit,
              nonce,
              type,
            },
            executionRequest,
          },
    };
  };
}

export function createBuildDappUnsignedTransactionHandler(params: {
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['buildDappUnsignedTransaction'] {
  const { chainProvider } = params;

  return async (prepared) => {
    const draft: ConfluxUnsignedTransaction = {
      chainType: NetworkType.Conflux,
      payload: {
        ...prepared.executionRequest,
        gasLimit: prepared.fee.gasLimit,
        storageLimit: prepared.fee.storageLimit,
        nonce: prepared.fee.nonce,
        type: prepared.fee.type ?? ('gasPrice' in prepared.fee.fields ? 0 : 2),
        ...('gasPrice' in prepared.fee.fields
          ? {
              gasPrice: prepared.fee.fields.gasPrice,
            }
          : {
              maxFeePerGas: prepared.fee.fields.maxFeePerGas,
              maxPriorityFeePerGas: prepared.fee.fields.maxPriorityFeePerGas,
            }),
        ...(prepared.fee.epochHeight == null ? {} : { epochHeight: prepared.fee.epochHeight }),
      },
    };

    return chainProvider.prepareUnsignedTransaction(draft);
  };
}
