import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { clampGasPrice } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';
import type { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import Decimal from 'decimal.js';
import { isEqual } from 'lodash-es';
import { useEffect, useState } from 'react';
import { filter, interval, map, startWith, switchMap } from 'rxjs';
export { type Level } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';

/**
 * get gas estimate from RPC , use the current network config
 */
const usePollingGasEstimateAndNonce = (tx: Partial<ITxEvm>) => {
  const [gasInfo, setGasInfo] = useState<(Awaited<ReturnType<typeof plugins.Transaction.estimate>> & { nonce: number }) | null>(null);
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    if (!currentNetwork) return;
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        map(() => currentNetwork),
        filter((v) => v !== null),
        switchMap((net) => {
          return Promise.all([
            plugins.Transaction.estimate({
              tx: {
                from: tx.from,
                to: tx.to,
                value: tx.value,
                data: tx.data,
              },
              network: net,
            }),
            plugins.Transaction.getTransactionCount({
              network: net,
              addressValue: tx.from!,
            }),
          ]);
        }),
      )
      .subscribe({
        next: ([_gasEstimate, nonceHex]) => {
          const gasEstimate = {
            ..._gasEstimate,
            ...(_gasEstimate.estimate
              ? {
                  estimate: Object.fromEntries(
                    Object.entries(_gasEstimate.estimate).map(([level, res]) => {
                      const clampedGasPrice = clampGasPrice(res.suggestedGasPrice, currentNetwork);
                      return [
                        level,
                        {
                          suggestedGasPrice: clampedGasPrice,
                          gasCost: new Decimal(clampedGasPrice).mul(_gasEstimate.gasLimit).toHex(),
                        },
                      ];
                    }),
                  ),
                }
              : null),
            ...(_gasEstimate.estimateOf1559
              ? {
                  estimateOf1559: Object.fromEntries(
                    Object.entries(_gasEstimate.estimateOf1559).map(([level, res]) => {
                      const clampedMaxFeePerGas = clampGasPrice(res.suggestedMaxFeePerGas, currentNetwork);
                      return [
                        level,
                        {
                          suggestedMaxFeePerGas: clampedMaxFeePerGas,
                          suggestedMaxPriorityFeePerGas: clampedMaxFeePerGas,
                          gasCost: new Decimal(clampedMaxFeePerGas).mul(_gasEstimate.gasLimit).toHex(),
                        },
                      ];
                    }),
                  ),
                }
              : null),
          } as typeof _gasEstimate;

          const newRes = { ...gasEstimate, nonce: Number(nonceHex) };
          setGasInfo((pre) => (isEqual(pre, newRes) ? pre : newRes));
        },
        error: (err) => {
          console.error('estimate gas error: ', err);
        },
      });

    return () => {
      pollingGasSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNetwork?.id, currentNetwork?.endpoint, tx.from, tx.data, tx.to, tx.value]);

  return gasInfo;
};

export default usePollingGasEstimateAndNonce;
