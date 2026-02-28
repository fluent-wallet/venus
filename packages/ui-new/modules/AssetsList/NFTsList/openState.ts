import { atom, useAtom, useAtomValue } from 'jotai';

export type OpenNftCollectionState = { contractAddress: string; index: number } | null;

const openNftCollectionAtom = atom<OpenNftCollectionState>(null);

export function useOpenNftCollection() {
  return useAtom(openNftCollectionAtom);
}

export function useOpenNftCollectionValue() {
  return useAtomValue(openNftCollectionAtom);
}
