import { useEffect, useState } from 'react';
import { interval, startWith, switchMap, map, filter } from 'rxjs';
import { isEqual } from 'lodash-es';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { notNull } from '@core/utils/rxjs';
export { type Level } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';

/**
 * get gas estimate from RPC , use the current network config
 */
const usePollingGasEstimateAndNonce = (tx: Partial<ITxEvm>) => {
  const [gasInfo, setGasInfo] = useState<(Awaited<ReturnType<typeof plugins.Transaction.estimate>> & { nonce: number }) | null>(null);
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        map(() => currentNetwork),
        filter(notNull),
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
        next: ([gasEstimate, nonceHex]) => {
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