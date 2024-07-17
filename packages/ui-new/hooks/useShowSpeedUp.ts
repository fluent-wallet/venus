import { useEffect, useState } from 'react';
import events from '@core/WalletCore/Events';
import { SPEED_UP_FEATURE } from '@utils/features';

export const useShowSpeedUp = (isPending: boolean, createAt?: Date) => {
  const [showSpeedUp, setShowSpeedUp] = useState(false);

  useEffect(() => {
    if (!isPending || !SPEED_UP_FEATURE.allow || !createAt || showSpeedUp) return;
    const checkShowSpeedUp = () => {
      const show = new Date().valueOf() - createAt.valueOf() > 5000;
      if (show) {
        setShowSpeedUp(true);
      }
      return show;
    };
    const _showSpeedUp = checkShowSpeedUp();
    if (_showSpeedUp) return;
    const subscription = events.globalIntervalSubject.subscribe(checkShowSpeedUp);
    return () => subscription.unsubscribe();
  }, [isPending, showSpeedUp, createAt]);
  return isPending && showSpeedUp;
};
