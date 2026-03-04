import { getQueryClient, getUiPreferencesService } from '@service/core';
import { useQuery } from '@tanstack/react-query';

export type Mode = import('@core/services').UiThemeMode;

export const getModeKey = () => ['preferences', 'mode'] as const;

export function useMode(): Mode {
  const prefs = getUiPreferencesService();
  const query = useQuery({
    queryKey: getModeKey(),
    queryFn: () => prefs.getMode(),
    initialData: 'system' as const,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (query.data ?? 'system') as Mode;
}

export function setMode(mode: Mode): void {
  getQueryClient().setQueryData(getModeKey(), mode);
  void getUiPreferencesService()
    .setMode(mode)
    .catch((error) => console.log(error));
}
