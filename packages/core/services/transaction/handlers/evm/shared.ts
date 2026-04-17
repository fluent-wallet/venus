import { CoreError, TX_INVALID_PARAMS } from '@core/errors';
import type { EvmUnsignedTransaction, Hex } from '@core/types';
import { convertBalanceToDecimal, trimDecimalZeros } from '@core/utils/balance';
import { NetworkType } from '@core/utils/consts';
import type { PreparedExecutionRequest, PreparedFee, TransactionQuotePresetOption, TransactionReviewOverride } from '../../stagedTypes';
import type { EvmHandlerDeps } from './types';

const FIXED_NATIVE_TRANSFER_GAS_LIMIT = '0x5208' as Hex;
export const toDisplayAmount = (value: bigint, decimals: number) => trimDecimalZeros(convertBalanceToDecimal(value.toString(), decimals));

const PRESET_MULTIPLIERS = {
  low: 90n,
  medium: 100n,
  high: 120n,
} as const;

function scaleEstimatedGasLimit(gasLimit: Hex, gasBuffer: number): Hex {
  const safeGasBuffer = gasBuffer > 0 ? gasBuffer : 1;
  const factor = BigInt(Math.round(safeGasBuffer * 1000));
  const buffered = (BigInt(gasLimit) * factor + 999n) / 1000n;

  return `0x${buffered.toString(16)}` as Hex;
}

async function isSimpleNativeTransfer(params: { ctx: EvmHandlerDeps['ctx']; to?: string; data: string }) {
  const { ctx, to, data } = params;

  if (!to || (data && data !== '0x')) {
    return false;
  }

  const isContract = await ctx.addressValidationService.isContractAddress({
    networkType: ctx.network.networkType,
    chainId: ctx.network.chainId,
    addressValue: to,
  });

  return !isContract;
}

export async function resolveTransferGasLimit(params: {
  ctx: EvmHandlerDeps['ctx'];
  chainProvider: Pick<EvmHandlerDeps['chainProvider'], 'rpc'>;
  from: string;
  to?: string;
  value: string;
  data: string;
  providedGasLimit?: Hex;
}): Promise<Hex> {
  if (params.providedGasLimit) {
    return params.providedGasLimit;
  }

  if (await isSimpleNativeTransfer({ ctx: params.ctx, to: params.to, data: params.data })) {
    return FIXED_NATIVE_TRANSFER_GAS_LIMIT;
  }

  const estimatedGas = (await params.chainProvider.rpc.request('eth_estimateGas', [
    {
      from: params.from,
      to: params.to,
      value: params.value,
      data: params.data,
    },
    'latest',
  ])) as Hex;

  return scaleEstimatedGasLimit(estimatedGas, params.ctx.network.gasBuffer);
}

function scaleFeeValue(base: bigint, multiplier: bigint): Hex {
  return `0x${((base * multiplier + 99n) / 100n).toString(16)}` as Hex;
}
export function getFeeUnitPrice(fields: { gasPrice?: string; maxFeePerGas?: string }): bigint {
  if (typeof fields.gasPrice === 'string') {
    return BigInt(fields.gasPrice);
  }

  if (typeof fields.maxFeePerGas === 'string') {
    return BigInt(fields.maxFeePerGas);
  }

  throw new Error('Missing fee fields.');
}

export function buildPresetOptions(params: {
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}): readonly TransactionQuotePresetOption[] {
  const gasLimit = BigInt(params.gasLimit);

  if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
    const baseMaxFeePerGas = BigInt(params.maxFeePerGas);
    const baseMaxPriorityFeePerGas = BigInt(params.maxPriorityFeePerGas);

    return (Object.entries(PRESET_MULTIPLIERS) as Array<[keyof typeof PRESET_MULTIPLIERS, bigint]>).map(([presetId, multiplier]) => {
      const maxFeePerGas = scaleFeeValue(baseMaxFeePerGas, multiplier);
      const scaledPriorityFee = scaleFeeValue(baseMaxPriorityFeePerGas, multiplier);
      const maxPriorityFeePerGas = BigInt(scaledPriorityFee) > BigInt(maxFeePerGas) ? maxFeePerGas : scaledPriorityFee;

      return {
        presetId,
        fee: { maxFeePerGas, maxPriorityFeePerGas },
        gasCost: `0x${(BigInt(maxFeePerGas) * gasLimit).toString(16)}` as Hex,
      };
    });
  }

  const gasPrice = params.gasPrice ?? '0x0';
  const baseGasPrice = BigInt(gasPrice);

  return (Object.entries(PRESET_MULTIPLIERS) as Array<[keyof typeof PRESET_MULTIPLIERS, bigint]>).map(([presetId, multiplier]) => {
    const nextGasPrice = scaleFeeValue(baseGasPrice, multiplier);
    return {
      presetId,
      fee: { gasPrice: nextGasPrice },
      gasCost: `0x${(BigInt(nextGasPrice) * gasLimit).toString(16)}` as Hex,
    };
  });
}

export function pickFee(presetOptions: readonly TransactionQuotePresetOption[], override?: TransactionReviewOverride) {
  const selection = override?.feeSelection ?? { kind: 'preset' as const, presetId: 'medium' as const };

  if (selection.kind === 'custom') {
    return { selection, fields: selection.fee };
  }

  const selected = presetOptions.find((item) => item.presetId === selection.presetId) ?? presetOptions[1];
  return { selection, fields: selected!.fee };
}

export function parseRpcQuantityToNumber(value: string | undefined, field: string): number | undefined {
  if (!value) return undefined;

  const asBigInt = BigInt(value);
  if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CoreError({
      code: TX_INVALID_PARAMS,
      message: 'Invalid JSON-RPC params.',
      context: { reason: `${field} exceeds Number.MAX_SAFE_INTEGER.` },
    });
  }

  return Number(asBigInt);
}

export function buildEvmUnsignedTransaction(params: { executionRequest: PreparedExecutionRequest; fee: PreparedFee }): EvmUnsignedTransaction {
  return {
    chainType: NetworkType.Ethereum,
    payload: {
      ...params.executionRequest,
      gasLimit: params.fee.gasLimit,
      nonce: params.fee.nonce,
      type: params.fee.type ?? ('gasPrice' in params.fee.fields ? 0 : 2),
      ...('gasPrice' in params.fee.fields
        ? {
            gasPrice: params.fee.fields.gasPrice,
          }
        : {
            maxFeePerGas: params.fee.fields.maxFeePerGas,
            maxPriorityFeePerGas: params.fee.fields.maxPriorityFeePerGas,
          }),
    },
  };
}
