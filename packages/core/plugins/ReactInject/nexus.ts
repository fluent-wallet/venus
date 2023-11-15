import { useCallback, useEffect } from 'react';
import { type Getter, type Setter } from 'jotai';
import { useAtomCallback } from 'jotai/utils';

const delayQueue: Array<Parameters<Setter>> = [];
export let getAtom = ((atom: any) => {
  const atomInDelayQueue = delayQueue.find((args) => args[0] === atom);
  if (atomInDelayQueue) {
    return atomInDelayQueue[1];
  } else {
    return undefined;
  }
}) as Getter;
export let setAtom = ((...args: any) => delayQueue.push(args)) as Setter;

export const JotaiNexus = () => {
  const init = useAtomCallback(
    useCallback((get, set) => {
      getAtom = get;
      setAtom = set;
      if (delayQueue.length > 0) {
        delayQueue.forEach((args) => setAtom(...args));
        delayQueue.length = 0;
      }
    }, [])
  );

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
