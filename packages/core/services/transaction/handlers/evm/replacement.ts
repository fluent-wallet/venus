import { PENDING_TX_STATUSES } from '@core/database/models/Tx/type';
import { CoreError, TX_INVALID_PARAMS } from '@core/errors';
import { AssetType, type Hex, SPEED_UP_ACTION } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import * as OxHex from 'ox/Hex';
import type { FeeFields } from '../../stagedTypes';
import type { TransactionHandlers } from '../types';
import { buildEvmUnsignedTransaction, getFeeUnitPrice, pickFee, toDisplayAmount } from './shared';
import type { EvmHandlerDeps } from './types';

const REPLACEMENT_PRESET_MULTIPLIERS = {
  low: 105n,
  medium: 110n,
  high: 120n,
} as const;

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}

function scaleReplacementFee(base: bigint, multiplier: bigint) {
  return (base * multiplier + 99n) / 100n;
}

function buildReplacementPresetOptions(params: {
  gasLimit: string;
  is1559: boolean;
  origin: {
    gasPrice?: string | null;
    maxFeePerGas?: string | null;
    maxPriorityFeePerGas?: string | null;
  };
  estimate: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
}) {
  const gasLimit = BigInt(params.gasLimit);

  if (params.is1559) {
    const baseMaxFeePerGas = maxBigInt(BigInt(params.origin.maxFeePerGas ?? '0x0'), BigInt(params.estimate.maxFeePerGas ?? params.estimate.gasPrice ?? '0x0'));
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
        gasCost: OxHex.fromNumber(maxFeePerGas * gasLimit),
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
      gasCost: OxHex.fromNumber(gasPrice * gasLimit),
    };
  });
}

function assertReplacementFeeBumped(params: {
  origin: {
    gasPrice?: string | null;
    maxFeePerGas?: string | null;
    maxPriorityFeePerGas?: string | null;
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

export function createReviewReplacementHandler({ ctx, chainProvider }: EvmHandlerDeps): TransactionHandlers['reviewReplacement'] {
  return async ({ originTx, request }) => {
    const [address, payload, extra] = await Promise.all([originTx.address.fetch(), originTx.txPayload.fetch(), originTx.txExtra.fetch()]);

    if (!PENDING_TX_STATUSES.includes(originTx.status)) {
      throw new CoreError({
        code: TX_INVALID_PARAMS,
        message: 'Transaction is not pending.',
        context: { txId: originTx.id, status: originTx.status },
      });
    }

    const from = payload.from ?? (await address.getValue());
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

    const is1559 = payload.type === '2' || !!payload.maxFeePerGas || !!payload.maxPriorityFeePerGas;
    const executionRequest = {
      from,
      to: action === SPEED_UP_ACTION.Cancel ? from : (payload.to ?? undefined),
      value: action === SPEED_UP_ACTION.Cancel ? ('0x0' as Hex) : (((payload.value as Hex | null) ?? '0x0') as Hex),
      data: action === SPEED_UP_ACTION.Cancel ? ('0x' as Hex) : (((payload.data as Hex | null) ?? '0x') as Hex),
      chainId: payload.chainId ?? ctx.network.chainId,
    };

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Ethereum,
      payload: {
        ...executionRequest,
        nonce: payload.nonce,
        gasLimit: request.override?.gasLimit ?? payload.gasLimit ?? undefined,
        type: is1559 ? 2 : 0,
      },
    });

    const gasLimit = request.override?.gasLimit ?? payload.gasLimit ?? estimate.gasLimit;
    const presetOptions = buildReplacementPresetOptions({
      gasLimit,
      is1559,
      origin: {
        gasPrice: payload.gasPrice,
        maxFeePerGas: payload.maxFeePerGas,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas,
      },
      estimate: {
        gasPrice: estimate.gasPrice,
        maxFeePerGas: estimate.maxFeePerGas,
        maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
      },
    });

    const { selection, fields } = pickFee(presetOptions, request.override);
    assertReplacementFeeBumped({
      origin: {
        gasPrice: payload.gasPrice,
        maxFeePerGas: payload.maxFeePerGas,
        maxPriorityFeePerGas: payload.maxPriorityFeePerGas,
      },
      next: fields,
    });

    const nativeBalances = await chainProvider.readFungibleAssetBalances(from, [{ assetType: AssetType.Native }]);
    const nativeBalance = BigInt(nativeBalances[0] ?? '0x0');
    const gasCost = getFeeUnitPrice(fields) * BigInt(gasLimit);

    const error =
      nativeBalance < gasCost
        ? ({
            code: 'insufficient_native_for_fee',
            message: 'Insufficient native balance for gas.',
          } as const)
        : null;

    return {
      summary: {
        action,
        fee: {
          payableGasFee: toDisplayAmount(gasCost, 18),
        },
      },
      fee: {
        selection,
        fields,
        gasLimit,
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
              nonce: payload.nonce,
              type: 'gasPrice' in fields ? 0 : 2,
            },
            executionRequest,
          },
    };
  };
}

export const buildReplacementUnsignedTransaction: TransactionHandlers['buildReplacementUnsignedTransaction'] = async (prepared) =>
  buildEvmUnsignedTransaction({
    executionRequest: prepared.executionRequest,
    fee: prepared.fee,
  });
