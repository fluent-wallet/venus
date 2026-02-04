import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useEffect, useState } from 'react';
import { interval, retry, startWith, switchMap } from 'rxjs';

export type { Level } from '@core/WalletCore/Plugins/Transaction/SuggestedGasEstimate';

/**
 * get gas price from RPC , use the current network config
 */
const usePollingGasPrice = () => {
  const [estimateCurrentGasPrice, setCurrentEstimateCurrentGasPrice] = useState<string | null>(null);
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    if (!currentNetwork) return;
    const pollingGasSub = interval(15000)
      .pipe(
        startWith(0),
        switchMap(() => plugins.Transaction.getGasPrice(currentNetwork)),
        retry({ delay: 1000 }),
      )
      .subscribe((_gasPrice) => {
        setCurrentEstimateCurrentGasPrice(_gasPrice);
      });

    return () => pollingGasSub.unsubscribe();
  }, [currentNetwork]);

  return estimateCurrentGasPrice;
};

export default usePollingGasPrice;
