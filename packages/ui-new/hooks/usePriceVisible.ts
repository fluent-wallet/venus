import { getQueryClient, getUiPreferencesService } from '@service/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

export const getTotalPriceVisibleKey = () => ['preferences', 'totalPriceVisible'] as const;

export function usePriceVisibleValue(): boolean {
  const prefs = getUiPreferencesService();
  const query = useQuery({
    queryKey: getTotalPriceVisibleKey(),
    queryFn: () => prefs.getTotalPriceVisible(),
    initialData: true,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return Boolean(query.data);
}

export function setPriceVisible(next: boolean): void {
  getQueryClient().setQueryData(getTotalPriceVisibleKey(), next);
  void getUiPreferencesService()
    .setTotalPriceVisible(next)
    .catch((error) => console.log(error));
}

export function usePriceVisible(): readonly [boolean, (next: boolean) => void] {
  const value = usePriceVisibleValue();
  const set = useCallback((next: boolean) => setPriceVisible(next), []);
  return [value, set] as const;
}
