import { useCallback, useEffect } from 'react';
import { Getter, Setter } from 'jotai';
import { useAtomCallback } from 'jotai/utils';

export let getAtom!: Getter;
export let setAtom!: Setter;

export const JotaiNexus = () => {
  const init = useAtomCallback(
    useCallback((get, set) => {
      getAtom = get;
      setAtom = set;
    }, [])
  );

  useEffect(() => {
    init();
  }, [init]);

  return null;
};