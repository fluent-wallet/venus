import type { ConfluxChainProviderLike, Hex } from '@core/types';
import { decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import * as OxHex from 'ox/Hex';
import * as OxValue from 'ox/Value';
import { buildPresetOptions } from '../evm/shared';
import type { TransactionHandlerContext, TransactionHandlers } from '../types';
import { FIXED_NATIVE_TRANSFER_GAS_LIMIT, FIXED_NATIVE_TRANSFER_STORAGE_LIMIT } from './shared';

function isSimpleNativeUserTransfer(to: string | undefined, data: string): boolean {
  if (!to || (data && data !== '0x')) {
    return false;
  }

  try {
    return decode(to).type === 'user';
  } catch {
    return false;
  }
}

function getMinGasPriceWei(ctx: TransactionHandlerContext): Hex {
  const gasConfig = ctx.config?.wallet?.gas;
  const chainId = ctx.network.chainId.toLowerCase();

  const gwei =
    gasConfig?.minGasPriceGweiByChain?.[ctx.network.networkType]?.[chainId] ?? gasConfig?.minGasPriceGweiByNetworkType?.[ctx.network.networkType] ?? 1;

  return OxHex.fromNumber(OxValue.fromGwei(String(gwei))) as Hex;
}

export function createQuoteTransactionHandler(params: {
  ctx: TransactionHandlerContext;
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['quoteTransaction'] {
  const { ctx, chainProvider } = params;

  return async (input) => {
    const nonce = input.withNonce === false ? null : await chainProvider.getNonce(input.from);
    const data = input.data ?? '0x';
    const value = input.value ?? '0x0';
    const isSimpleNativeTransfer = isSimpleNativeUserTransfer(input.to, data);

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Conflux,
      payload: {
        chainId: ctx.network.chainId,
        from: input.from,
        to: input.to,
        value,
        data,
        ...(isSimpleNativeTransfer
          ? {
              gasLimit: FIXED_NATIVE_TRANSFER_GAS_LIMIT,
              storageLimit: FIXED_NATIVE_TRANSFER_STORAGE_LIMIT,
            }
          : {}),
        ...(nonce == null ? {} : { nonce }),
      },
    });

    const gasLimit = isSimpleNativeTransfer ? FIXED_NATIVE_TRANSFER_GAS_LIMIT : (estimate.gasLimit as Hex);
    const storageLimit = isSimpleNativeTransfer ? FIXED_NATIVE_TRANSFER_STORAGE_LIMIT : (estimate.storageLimit as Hex);

    return {
      gasLimit,
      storageLimit,
      nonce,
      constraints: {
        minGasPriceWei: getMinGasPriceWei(ctx),
      },
      presetOptions: buildPresetOptions({
        gasLimit,
        gasPrice: estimate.gasPrice,
        maxFeePerGas: estimate.maxFeePerGas,
        maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
      }),
    };
  };
}
