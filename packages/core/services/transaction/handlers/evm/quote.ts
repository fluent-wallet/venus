import type { Hex } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import type { TransactionHandlers } from '../types';
import { buildPresetOptions } from './shared';
import type { EvmHandlerDeps } from './types';

export function createQuoteTransactionHandler({ ctx, chainProvider }: EvmHandlerDeps): TransactionHandlers['quoteTransaction'] {
  return async (input) => {
    const nonce = input.withNonce === false ? null : await chainProvider.getNonce(input.from);

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Ethereum,
      payload: {
        chainId: ctx.network.chainId,
        from: input.from,
        to: input.to,
        value: input.value ?? '0x0',
        data: input.data ?? '0x',
        ...(nonce == null ? {} : { nonce }),
      },
    });

    return {
      gasLimit: estimate.gasLimit as Hex,
      gasPrice: (estimate.gasPrice ?? '0x0') as Hex,
      nonce,
      constraints: {
        minGasPriceWei: '0x0',
      },
      presetOptions: buildPresetOptions({
        gasLimit: estimate.gasLimit,
        gasPrice: estimate.gasPrice,
        maxFeePerGas: estimate.maxFeePerGas,
        maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
      }),
    };
  };
}
