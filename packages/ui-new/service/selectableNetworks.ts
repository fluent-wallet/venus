import { NetworkType } from '@core/utils/consts';
import { useMemo } from 'react';
import { useCurrentNetwork, useNetworks } from './network';

export function useSelectableNetworks() {
  const { data: networks } = useNetworks();
  const { data: currentNetwork } = useCurrentNetwork();
  const selectableNetworks = useMemo(
    () =>
      networks?.filter(
        (network) =>
          (network.netId === 1029 && network.networkType === NetworkType.Conflux) ||
          (network.netId === 1 && network.networkType === NetworkType.Conflux) ||
          (network.netId === 1030 && network.networkType === NetworkType.Ethereum) ||
          (network.netId === 71 && network.networkType === NetworkType.Ethereum),
      ) ?? [],
    [networks],
  );

  return { networks: selectableNetworks, currentNetworkId: currentNetwork?.id };
}
