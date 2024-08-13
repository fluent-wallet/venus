import { useEffect, useState } from 'react';
import events from '@core/WalletCore/Events';
import { SPEED_UP_FEATURE } from '@utils/features';
import type { Tx } from '@core/database/models/Tx';
import { formatStatus } from '@core/utils/tx';
import { useWalletConfig } from '@core/WalletCore/Plugins/ReactInject/data/useWalletConfig';

export const useShowSpeedUp = (tx: Tx | null) => {
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const walletConfig = useWalletConfig();
  const status = tx && formatStatus(tx);
  const isPending = status === 'pending';

  useEffect(() => {
    if (!isPending || !SPEED_UP_FEATURE.allow || !tx || showSpeedUp) return;
    const checkShowSpeedUp = () => {
      const show = new Date().valueOf() - tx.createdAt.valueOf() > walletConfig.pendingTimeBeforeSpeedUp;
      if (show) {
        setShowSpeedUp(true);
      }
      return show;
    };
    const _showSpeedUp = checkShowSpeedUp();
    if (_showSpeedUp) return;
    const subscription = events.globalIntervalSubject.subscribe(checkShowSpeedUp);
    return () => subscription.unsubscribe();
  }, [isPending, showSpeedUp, tx, walletConfig.pendingTimeBeforeSpeedUp]);
  return isPending && showSpeedUp;
};
