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

  const refreshOnce = useCallback(async () => {
    await getAssetsSyncService().refreshCurrent({ reason: 'manual' });

    // this jobs need some time to complete we don't want to block the refresh
    queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
    queryClient.invalidateQueries({ queryKey: getNftRootKey() });
    queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
  }, [queryClient]);

  return useCallback(
    (done: VoidFunction) => {
      void refreshOnce().finally(done);
    },
    [refreshOnce],
  );
}
