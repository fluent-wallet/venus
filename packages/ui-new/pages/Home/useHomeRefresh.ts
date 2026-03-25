import { getAssetRootKey } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { getNftRootKey } from '@service/nft';
import { getTransactionRootKey } from '@service/transaction';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Home pull-to-refresh handler used by `RefreshScrollView`.
 */
export function useHomeRefresh(): (done: VoidFunction) => void {
  const queryClient = useQueryClient();

  const invalidateHomeQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
    void queryClient.invalidateQueries({ queryKey: getNftRootKey() });
    void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
  }, [queryClient]);

  const refreshOnce = useCallback(async () => {
    await getAssetsSyncService().refreshCurrent({ reason: 'manual' });

    // These jobs need some time to complete. Do not block the refresh animation.
    invalidateHomeQueries();
  }, [invalidateHomeQueries]);

  return useCallback(
    (done: VoidFunction) => {
      void refreshOnce().finally(done);
    },
    [refreshOnce],
  );
}
