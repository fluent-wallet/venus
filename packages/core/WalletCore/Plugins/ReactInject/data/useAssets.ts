import Decimal from 'decimal.js';
import { atom, useAtomValue } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { useMemo } from 'react';
import type { Address } from '../../../../database/models/Address';
import { AssetType } from '../../../../database/models/Asset';
import type { Network } from '../../../../database/models/Network';
import { truncate } from '../../../../utils/balance';
import type { AssetInfo } from '../../AssetsTracker/types';
import type { NFTItemDetail } from '../../NFTDetailTracker';
import { getAtom, setAtom } from '../nexus';
import { getCurrentAddress, useCurrentAddress } from './useCurrentAddress';
import { getCurrentNetwork, useCurrentNetwork } from './useCurrentNetwork';

export const getAssetsAtomKey = ({ network, address }: { network: Network | null; address: Address | null }) =>
  network && address ? `${network.networkType}-${network.chainId}-${address.hex}` : 'null';

const assetsInFetchAtom = atomFamily((_: string) => atom<boolean>(false));
const assetsSortedKeysAtom = atomFamily((_: string) => atom<Array<string> | []>([]));
const assetsHashAtom = atomFamily((_: string) => atom<Record<string, AssetInfo> | null>(null));
const assetsListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assetsHash = get(assetsHashAtom(key));
    const assetsSortedKeys = get(assetsSortedKeysAtom(key));
    return !assetsHash ? null : assetsSortedKeys?.map((hashKey) => assetsHash[hashKey]).filter(Boolean);
  }),
);
const assetsTokenListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets ? assets.filter((asset) => asset.type === AssetType.Native || asset.type === AssetType.ERC20) : null;
  }),
);
const assetsNFTListAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets ? assets.filter((asset) => asset.type === AssetType.ERC721 || asset.type === AssetType.ERC1155) : null;
  }),
);
const assetsTotalPriceValueAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsListAtom(key));
    return assets === null
      ? null
      : !assets?.length
        ? '0'
        : truncate(assets.reduce((total, item) => total.add(new Decimal(item?.priceValue ?? 0)), new Decimal(0)).toString(), 2);
  }),
);
const tokensEmptyAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsTokenListAtom(key));
    return assets === null ? null : !assets?.length ? true : assets?.every((asset) => BigInt(isNaN(Number(asset?.balance)) ? 0 : Number(asset?.balance)) <= 0);
  }),
);

const nftsEmptyAtom = atomFamily((key: string) =>
  atom((get) => {
    const assets = get(assetsNFTListAtom(key));
    return assets === null ? null : !assets?.length;
  }),
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

export const setAssetsInFetch = (key: string, inFetch: boolean) => setAtom(assetsInFetchAtom(key), inFetch);
export const getAssetsInFetch = (key: string) => getAtom(assetsInFetchAtom(key));
export const useAssetsInFetch = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(assetsInFetchAtom(key));
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

export const getAssetsTokenList = () => {
  const network = getCurrentNetwork();
  const address = getCurrentAddress();
  const key = getAssetsAtomKey({ network, address });
  return getAtom(assetsTokenListAtom(key));
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

export const useIsTokensEmpty = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(tokensEmptyAtom(key));
};

export const useIsNftsEmpty = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  const key = useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
  return useAtomValue(nftsEmptyAtom(key));
};

export const useCurrentAssetsKey = () => {
  const network = useCurrentNetwork();
  const address = useCurrentAddress();
  return useMemo(() => getAssetsAtomKey({ network, address }), [network, address]);
};

export const useAssetsTotalPriceValueWithKey = (key: string) => useAtomValue(assetsTotalPriceValueAtom(key));

const currentOpenNFTDetailAtom = atom<{ nft: AssetInfo; index?: number; items?: Array<NFTItemDetail> } | undefined>(undefined);
export const getCurrentOpenNFTDetail = () => getAtom(currentOpenNFTDetailAtom);
export const setCurrentOpenNFTDetail = (data?: { nft: AssetInfo; index?: number; items?: Array<NFTItemDetail> }) => setAtom(currentOpenNFTDetailAtom, data);
export const useCurrentOpenNFTDetail = () => useAtomValue(currentOpenNFTDetailAtom);
