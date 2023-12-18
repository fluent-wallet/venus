import { useMemo } from 'react';
import { atom, useAtomValue } from 'jotai';
import { atomFamily } from 'jotai/utils';
import Decimal from 'decimal.js';
import { getAtom, setAtom } from '../nexus';
import { type Network } from '../../../../database/models/Network';
import { type Address } from '../../../../database/models/Address';
import { AssetType } from '../../../../database/models/Asset';
import { useCurrentNetwork } from './useCurrentNetwork';
import { useCurrentAddress } from './useCurrentAddress';
import { type AssetInfo } from '../../AssetsTracker/types';
import { truncate } from '../../../../utils/balance';

export const getAssetsAtomKey = ({ network, address }: { network: Network | null; address: Address | null }) =>
  network && address ? `${network.networkType}-${network.chainId}-${address.hex}` : 'null';

/** null means loading... */
const assetsSortedKeysAtom = atomFamily((_: string) => atom<Array<string> | []>([]));
const assetsHashAtom = atomFamily((_: string) => atom<Record<string, AssetInfo> | null>(null));
const assetsListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assetsHash = get(assetsHashAtom(key));
    const assetsSortedKeys = get(assetsSortedKeysAtom(key));
    return !assetsHash ? null : assetsSortedKeys?.map((hashKey) => assetsHash[hashKey]).filter(Boolean);
  })
);
const assetsTokenListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets ? assets.filter((asset) => asset.type === AssetType.Native || asset.type === AssetType.ERC20) : null;
  })
);
const assetsNFTListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets ? assets.filter((asset) => asset.type === AssetType.ERC721 || asset.type === AssetType.ERC1155) : null;
  })
);
const assetsTotalPriceValueAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets === null
      ? null
      : !assets?.length
      ? '0.00'
      : truncate(assets.reduce((total, item) => total.add(new Decimal(item?.priceValue ?? 0)), new Decimal(0)).toString(), 2);
  })
);

export const getAssetsSortedKeys = (key: string) => getAtom(assetsSortedKeysAtom(key));
export const setAssetsSortedKeys = (key: string, assetsSortedKeys: Array<string>) => setAtom(assetsSortedKeysAtom(key), assetsSortedKeys);
export const setAssetsHash = (key: string, assetsHash: Record<string, AssetInfo>) => setAtom(assetsHashAtom(key), assetsHash);
export const getAssetsHash = (key: string) => getAtom(assetsHashAtom(key));
export const useAssetsHash = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsHashAtom(key));
};

export const useAssetsAllList = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsListAtom(key));
};

export const useAssetsTokenList = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsTokenListAtom(key));
};

export const useAssetsNFTList = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsNFTListAtom(key));
};

export const useAssetsTotalPriceValue = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsTotalPriceValueAtom(key));
};
