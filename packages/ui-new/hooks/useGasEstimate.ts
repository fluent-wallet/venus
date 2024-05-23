import Plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { ITxEvm } from '@core/WalletCore/Plugins/Transaction/types';
import { useEffect, useState } from 'react';
import { interval, startWith, switchMap, map, filter } from 'rxjs';
const notNull = <T>(value: T | null): value is T => value !== null;
/**
 * get gas estimate from RPC , use the current network config
 */
export const useGasEstimate = (tx: Partial<ITxEvm>) => {
  const [gasInfo, setGasInfo] = useState<Awaited<ReturnType<typeof Plugins.Transaction.estimate>> | null>(null);
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        map(() => currentNetwork),
        filter(notNull),
        switchMap((net) => {
          return Plugins.Transaction.estimate({
            tx: tx,
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
  }, [currentNetwork?.id, currentNetwork?.endpoint, tx]);

  return gasInfo;
};
