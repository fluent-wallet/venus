import { getAssetRootKey } from '@service/asset';
import { getAssetsSyncService } from '@service/core';
import { getNftRootKey } from '@service/nft';
import { getTransactionRootKey } from '@service/transaction';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Home pull-to-refresh handler shared by all tabs.
 */
export function useHomeRefresh(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await getAssetsSyncService().refreshCurrent({ reason: 'manual' });

    // These follow-up invalidations can run in the background after the manual refresh starts.
    void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
    void queryClient.invalidateQueries({ queryKey: getNftRootKey() });
    void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
  }, [queryClient]);
}
