import { TxStatus } from '@core/types';
import { getRuntimeConfig } from '@service/core';
import { useEffect, useState } from 'react';

export const useShowSpeedUp = (tx: { status: TxStatus; createdAtMs: number } | null) => {
  const [showSpeedUp, setShowSpeedUp] = useState(false);
  const isPending = tx?.status === TxStatus.Pending;

  useEffect(() => {
    if (!isPending || !tx || showSpeedUp) return;

    const threshold = getRuntimeConfig().wallet?.pendingTimeBeforeSpeedUpMs ?? 15_000;

    const timeEnd = Date.now() - tx.createdAtMs;

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
