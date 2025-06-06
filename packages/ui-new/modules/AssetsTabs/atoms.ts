import { setAtom } from '@core/WalletCore/Plugins/ReactInject';
import { atom, useAtomValue } from 'jotai';

const createStickyNFTScrollAtom = () => {
  const tabPageViewScrollYAtom = atom(0);
  const setScrollY = (height: number) => setAtom(tabPageViewScrollYAtom, height);
  const useTabPageViewScrollY = () => useAtomValue(tabPageViewScrollYAtom);
  return {
    setScrollY,
    useTabPageViewScrollY,
  };
};
export const { setScrollY: setHomeScrollY, useTabPageViewScrollY: useHomeTabPageViewScrollY } = createStickyNFTScrollAtom();
export const { setScrollY: setSelectAssetScrollY, useTabPageViewScrollY: useSelectAssetTabPageViewScrollY } = createStickyNFTScrollAtom();

export const mapOfUseTabPageViewScrollY = {
  Home: useHomeTabPageViewScrollY,
  SelectAsset: useSelectAssetTabPageViewScrollY,
};

export const mapOfSetScrollY = {
  Home: setHomeScrollY,
  SelectAsset: setSelectAssetScrollY,
};
