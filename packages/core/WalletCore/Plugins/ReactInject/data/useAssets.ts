import { useMemo } from 'react';
import { atom, useAtomValue } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { getAtom, setAtom } from '../nexus';
import { type Network } from '../../../../database/models/Network';
import { type Address } from '../../../../database/models/Address';
import { useCurrentNetwork } from './useCurrentNetwork';
import { useCurrentAddress } from './useCurrentAddress';

export const getAtomKey = ({ network, address }: { network: Network | null; address: Address | null }) =>
  network && address ? `${network.networkType}=${network.chainId}=${address.hex}` : 'null';

const assetsListAtom = atomFamily(() => atom<Array<any>>([]));

export const getAssets = (key: string) => getAtom(assetsListAtom(key));
export const setAssets = (key: string, assets: Array<any>) => setAtom(assetsListAtom(key), assets);
export const useAssets = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsListAtom(key));
};