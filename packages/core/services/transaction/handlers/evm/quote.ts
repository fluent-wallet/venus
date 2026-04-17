import { NetworkType } from '@core/utils/consts';
import type { TransactionHandlers } from '../types';
import { buildPresetOptions, resolveTransferGasLimit } from './shared';
import type { EvmHandlerDeps } from './types';

export function createQuoteTransactionHandler({ ctx, chainProvider }: EvmHandlerDeps): TransactionHandlers['quoteTransaction'] {
  return async (input) => {
    const nonce = input.withNonce === false ? null : await chainProvider.getNonce(input.from);
    const data = input.data ?? '0x';
    const value = input.value ?? '0x0';

    const gasLimit = await resolveTransferGasLimit({
      ctx,
      chainProvider,
      from: input.from,
      to: input.to,
      value,
      data,
    });

    const estimate = await chainProvider.estimateFee({
      chainType: NetworkType.Ethereum,
      payload: {
        chainId: ctx.network.chainId,
        from: input.from,
        to: input.to,
        value,
        data,
        gasLimit,
        ...(nonce == null ? {} : { nonce }),
      },
    });

    return {
      gasLimit,
      nonce,
      constraints: {
        minGasPriceWei: '0x0',
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
