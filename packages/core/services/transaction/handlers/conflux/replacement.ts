import { PENDING_TX_STATUSES } from '@core/database/models/Tx/type';
import { CoreError, TX_INVALID_PARAMS } from '@core/errors';
import { AssetType, type ConfluxChainProviderLike, type ConfluxUnsignedTransaction, type Hex, SPEED_UP_ACTION } from '@core/types';
import { decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import * as OxHex from 'ox/Hex';
import type { FeeFields, ReviewError } from '../../stagedTypes';
import { getFeeUnitPrice, pickFee, toDisplayAmount } from '../evm/shared';
import type { TransactionHandlers } from '../types';
import { getStorageCollateralDrip } from './shared';

const REPLACEMENT_PRESET_MULTIPLIERS = {
  low: 105n,
  medium: 110n,
  high: 120n,
} as const;

function emptyStringToUndefined(value: string | null | undefined): string | undefined {
  return value ? value : undefined;
}

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}

function scaleReplacementFee(base: bigint, multiplier: bigint) {
  // Round up after applying the preset multiplier so replacement fees still increase for very small base values.
  return (base * multiplier + 99n) / 100n;
}

function getContractAddressForSponsorCheck(to?: string): string | null {
  if (!to) return null;

  try {
    return decode(to).type === 'contract' ? to : null;
  } catch {
    return null;
  }
}

function buildReplacementPresetOptions(params: {
  gasLimit: string;
  is1559: boolean;
  origin: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  estimate: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
}) {
  const gasLimit = BigInt(params.gasLimit);

  if (params.is1559) {
    const baseMaxFeePerGas = maxBigInt(BigInt(params.origin.maxFeePerGas ?? '0x0'), BigInt(params.estimate.maxFeePerGas ?? '0x0'));
    const baseMaxPriorityFeePerGas = maxBigInt(BigInt(params.origin.maxPriorityFeePerGas ?? '0x0'), BigInt(params.estimate.maxPriorityFeePerGas ?? '0x0'));

    return (Object.entries(REPLACEMENT_PRESET_MULTIPLIERS) as Array<[keyof typeof REPLACEMENT_PRESET_MULTIPLIERS, bigint]>).map(([presetId, multiplier]) => {
      const maxFeePerGas = scaleReplacementFee(baseMaxFeePerGas, multiplier);
      const scaledPriorityFee = scaleReplacementFee(baseMaxPriorityFeePerGas, multiplier);
      const maxPriorityFeePerGas = scaledPriorityFee > maxFeePerGas ? maxFeePerGas : scaledPriorityFee;

      return {
        presetId,
        fee: {
          maxFeePerGas: OxHex.fromNumber(maxFeePerGas),
          maxPriorityFeePerGas: OxHex.fromNumber(maxPriorityFeePerGas),
        },
        gasCost: OxHex.fromNumber(maxFeePerGas * gasLimit) as Hex,
      };
    });
  }

  const baseGasPrice = maxBigInt(BigInt(params.origin.gasPrice ?? '0x0'), BigInt(params.estimate.gasPrice ?? '0x0'));

  return (Object.entries(REPLACEMENT_PRESET_MULTIPLIERS) as Array<[keyof typeof REPLACEMENT_PRESET_MULTIPLIERS, bigint]>).map(([presetId, multiplier]) => {
    const gasPrice = scaleReplacementFee(baseGasPrice, multiplier);

    return {
      presetId,
      fee: {
        gasPrice: OxHex.fromNumber(gasPrice),
      },
      gasCost: OxHex.fromNumber(gasPrice * gasLimit) as Hex,
    };
  });
}
function assertReplacementFeeBumped(params: {
  origin: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  next: FeeFields;
}) {
  const { origin, next } = params;
  const originIs1559 = !!origin.maxFeePerGas || !!origin.maxPriorityFeePerGas;

  if (originIs1559) {
    if ('gasPrice' in next) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction requires EIP-1559 fee fields.',
        context: {
          originMaxFeePerGas: origin.maxFeePerGas,
          originMaxPriorityFeePerGas: origin.maxPriorityFeePerGas,
        },
      });
    }

    const originMaxFeePerGas = BigInt(origin.maxFeePerGas ?? '0x0');
    const originMaxPriorityFeePerGas = BigInt(origin.maxPriorityFeePerGas ?? '0x0');
    const nextMaxFeePerGas = BigInt(next.maxFeePerGas);
    const nextMaxPriorityFeePerGas = BigInt(next.maxPriorityFeePerGas);

    if (nextMaxFeePerGas <= originMaxFeePerGas) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction maxFeePerGas is not bumped.',
        context: {
          originMaxFeePerGas: origin.maxFeePerGas,
          maxFeePerGas: next.maxFeePerGas,
        },
      });
    }

    if (nextMaxPriorityFeePerGas < originMaxPriorityFeePerGas) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction maxPriorityFeePerGas is not bumped.',
        context: {
          originMaxPriorityFeePerGas: origin.maxPriorityFeePerGas,
          maxPriorityFeePerGas: next.maxPriorityFeePerGas,
        },
      });
    }

    if (nextMaxPriorityFeePerGas > nextMaxFeePerGas) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement transaction maxPriorityFeePerGas exceeds maxFeePerGas.',
        context: {
          maxFeePerGas: next.maxFeePerGas,
          maxPriorityFeePerGas: next.maxPriorityFeePerGas,
        },
      });
    }

    return;
  }

  if (typeof next.gasPrice !== 'string') {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Replacement transaction requires legacy gasPrice.',
      context: {
        originGasPrice: origin.gasPrice,
      },
    });
  }

  const originGasPrice = BigInt(origin.gasPrice ?? '0x0');
  const nextGasPrice = BigInt(next.gasPrice);

  if (nextGasPrice <= originGasPrice) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Replacement transaction gasPrice is not bumped.',
      context: {
        originGasPrice: origin.gasPrice,
        gasPrice: next.gasPrice,
      },
    });
  }
}

function resolveContractExecutionTarget(to?: string): string | null {
  if (!to) return null;

  try {
    return decode(to).type === 'contract' ? to : null;
  } catch {
    return null;
  }
}
async function resolvePayableFeeState(params: {
  chainProvider: ConfluxChainProviderLike;
  from: string;
  to?: string;
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
  const contractAddress = getContractAddressForSponsorCheck(params.to);

  if (!contractAddress) {
    return {
      payableGasFee: gasFee,
      payableStorageCollateral: storageCollateral,
    };
  }

  try {
    const response = (await params.chainProvider.rpc.request('cfx_checkBalanceAgainstTransaction', [
      params.from,
      contractAddress,
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

export function createReviewReplacementHandler(params: {
  ctx: { network: { chainId: string; networkType: NetworkType } };
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['reviewReplacement'] {
  const { ctx, chainProvider } = params;

  return async ({ originTx, request }) => {
    const [address, payload, extra] = await Promise.all([originTx.address.fetch(), originTx.txPayload.fetch(), originTx.txExtra.fetch()]);

    if (!PENDING_TX_STATUSES.includes(originTx.status)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Transaction is not pending.',
        context: { txId: originTx.id, status: originTx.status },
      });
    }

    const from = emptyStringToUndefined(payload.from) ?? (await address.getValue());
    const action = extra.sendAction === SPEED_UP_ACTION.Cancel ? SPEED_UP_ACTION.Cancel : request.action;

    if (typeof payload.nonce !== 'number') {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Origin transaction nonce is missing.',
        context: { txId: originTx.id },
      });
    }

    if (request.override?.nonce != null && request.override.nonce !== payload.nonce) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Replacement nonce mismatch.',
        context: {
          txId: originTx.id,
          originNonce: payload.nonce,
          nonce: request.override.nonce,
        },
      });
    }

    const originFeeFields = {
      gasPrice: emptyStringToUndefined(payload.gasPrice),
      maxFeePerGas: emptyStringToUndefined(payload.maxFeePerGas),
      maxPriorityFeePerGas: emptyStringToUndefined(payload.maxPriorityFeePerGas),
    };
    const is1559 = payload.type === '2' || !!originFeeFields.maxFeePerGas || !!originFeeFields.maxPriorityFeePerGas;
    const originTo = emptyStringToUndefined(payload.to);
    const originValue = (emptyStringToUndefined(payload.value) ?? '0x0') as Hex;
    const originData = (emptyStringToUndefined(payload.data) ?? '0x') as Hex;
    const originChainId = emptyStringToUndefined(payload.chainId) ?? ctx.network.chainId;
    const originGasLimit = emptyStringToUndefined(payload.gasLimit);
    const originStorageLimit = emptyStringToUndefined(payload.storageLimit);

    const executionRequest = {
      from,
      to: action === SPEED_UP_ACTION.Cancel ? from : originTo,
      value: action === SPEED_UP_ACTION.Cancel ? ('0x0' as Hex) : originValue,
      data: action === SPEED_UP_ACTION.Cancel ? ('0x' as Hex) : originData,
      chainId: originChainId,
    };

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Conflux,
      payload: {
        ...executionRequest,
        nonce: payload.nonce,
        type: is1559 ? 2 : 0,
        ...(request.override?.gasLimit ? { gasLimit: request.override.gasLimit } : originGasLimit ? { gasLimit: originGasLimit } : {}),
        ...(request.override?.storageLimit ? { storageLimit: request.override.storageLimit } : originStorageLimit ? { storageLimit: originStorageLimit } : {}),
      },
    });

    const gasLimit = request.override?.gasLimit ?? originGasLimit ?? estimate.gasLimit;
    const storageLimit = request.override?.storageLimit ?? originStorageLimit ?? estimate.storageLimit;

    const presetOptions = buildReplacementPresetOptions({
      gasLimit,
      is1559,
      origin: originFeeFields,
      estimate: {
        gasPrice: estimate.gasPrice,
        maxFeePerGas: estimate.maxFeePerGas,
        maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
      },
    });

    const { selection, fields } = pickFee(presetOptions, request.override);
    assertReplacementFeeBumped({
      origin: originFeeFields,
      next: fields,
    });

    const payableFeeState = await resolvePayableFeeState({
      chainProvider,
      from,
      to: executionRequest.to,
      gasLimit,
      storageLimit,
      feeFields: fields,
    });

    if ('error' in payableFeeState) {
      return {
        summary: null,
        fee: null,
        presetOptions: [],
        error: { ...payableFeeState.error },
        canSubmit: false,
        prepared: null,
      };
    }

    const nativeBalances = await chainProvider.readFungibleAssetBalances(from, [{ assetType: AssetType.Native }]);
    const nativeBalance = BigInt(nativeBalances[0] ?? '0x0');
    const requiredNative = BigInt(executionRequest.value) + payableFeeState.payableGasFee + payableFeeState.payableStorageCollateral;

    const error =
      nativeBalance < requiredNative
        ? ({
            code: 'insufficient_native_for_fee',
            message: executionRequest.value === '0x0' ? 'Insufficient native balance for fee.' : 'Insufficient native balance.',
          } as const)
        : null;

    return {
      summary: {
        action,
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
        nonce: payload.nonce,
      },
      presetOptions,
      error,
      canSubmit: !error,
      prepared: error
        ? null
        : {
            preparedKind: 'replacement',
            addressId: address.id,
            networkType: ctx.network.networkType,
            originTxId: originTx.id,
            action,
            fee: {
              fields,
              gasLimit,
              storageLimit,
              nonce: payload.nonce,
              type: 'gasPrice' in fields ? 0 : 2,
            },
            executionRequest,
            runtimeHints: {
              refreshEpochHeightOnExecute: true,
            },
          },
    };
  };
}

export function createBuildReplacementUnsignedTransactionHandler(params: {
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['buildReplacementUnsignedTransaction'] {
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
      },
    };

    return chainProvider.prepareUnsignedTransaction(draft);
  };
}
