import type { Tx } from '@core/database/models/Tx';
import { formatStatus } from '@core/utils/tx';
import { useWalletConfig } from '@core/WalletCore/Plugins/ReactInject/data/useWalletConfig';
import { useEffect, useState } from 'react';

export const useShowSpeedUp = (tx: Tx | null) => {
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const walletConfig = useWalletConfig();
  const status = tx && formatStatus(tx);
  const isPending = status === 'pending';

  useEffect(() => {
    if (!isPending || !tx || showSpeedUp) return;

    const threshold = walletConfig.pendingTimeBeforeSpeedUp;

    const timeEnd = new Date().valueOf() - tx.createdAt.valueOf();

    // if the transaction is older than the threshold, show the speed up option
    if (timeEnd >= threshold) {
      setShowSpeedUp(true);
    } else {
      const timeLeft = threshold - timeEnd;

      const timerId = setTimeout(() => {
        setShowSpeedUp(true);
      }, timeLeft);

      return () => {
        clearTimeout(timerId);
      };
    }
  }, [isPending, showSpeedUp, tx, walletConfig.pendingTimeBeforeSpeedUp]);
  return isPending && showSpeedUp;
};
