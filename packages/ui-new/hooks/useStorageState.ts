import { getKeyValueStorageService } from '@service/core';
import { useCallback, useLayoutEffect, useState } from 'react';

const useStorageState = <T>({ initState, key }: { initState: T; key: string }) => {
  const [state, _setState] = useState<T>(null!);

  useLayoutEffect(() => {
    const init = async () => {
      const localState = await getKeyValueStorageService().get(key);
      if (typeof localState !== 'undefined' && localState !== null) {
        _setState(localState as T);
      } else {
        _setState(initState);
      }
    };
    void init().catch((error) => console.log(error));
  }, [initState, key]);

  const setState = useCallback(
    (newState: T | ((currentState: T) => T)) => {
      if (typeof newState === 'function') {
        const setFunc = (currentState: T) => {
          const newRes = (newState as (currentState: T) => T)(currentState);
          void getKeyValueStorageService()
            .set(key, newRes)
            .catch((error) => console.log(error));
          return newRes;
        };
        _setState(setFunc);
      } else {
        _setState(newState);
        void getKeyValueStorageService()
          .set(key, newState)
          .catch((error) => console.log(error));
      }
    },
    [key],
  );

  return [state as T | undefined, setState] as const;
};

export default useStorageState;
