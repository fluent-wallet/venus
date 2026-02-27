import type { Tx } from '@core/database/models/Tx';
import { formatStatus } from '@core/utils/tx';
import { getRuntimeConfig } from '@service/core';
import { useEffect, useState } from 'react';

export const useShowSpeedUp = (tx: Tx | null) => {
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const status = tx && formatStatus(tx);
  const isPending = status === 'pending';

  useEffect(() => {
    if (!isPending || !tx || showSpeedUp) return;

    const threshold = getRuntimeConfig().wallet?.pendingTimeBeforeSpeedUpMs ?? 15_000;

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
  }, [isPending, showSpeedUp, tx]);
  return isPending && showSpeedUp;
};
