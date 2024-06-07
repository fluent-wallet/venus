import { useEffect, useState } from 'react';
import { interval, startWith, switchMap, map, filter } from 'rxjs';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { notNull } from '@core/utils/rxjs';
export type Level = 'high' | 'medium' | 'low';

/**
 * get gas estimate from RPC , use the current network config
 */
const useGasEstimate = (tx: Partial<ITxEvm>) => {
  const [gasInfo, setGasInfo] = useState<Awaited<ReturnType<typeof plugins.Transaction.estimate>> | null>(null);
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        map(() => currentNetwork),
        filter(notNull),
        switchMap((net) => {
          return plugins.Transaction.estimate({
            tx: {
              from: tx.from,
              to: tx.to,
              value: tx.value,
              data: tx.data,
            },
            network: net,
          });
        }),
      )
      .subscribe({
        next: (res) => {
          setGasInfo(res);
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

export default useGasEstimate;