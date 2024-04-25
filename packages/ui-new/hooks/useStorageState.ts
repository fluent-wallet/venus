import { useState, useCallback, useLayoutEffect } from 'react';
import database from '@core/database';

const useStorageState = <T>({ initState, key }: { initState: T; key: string }) => {
  const [state, _setState] = useState<T>(null!);

  useLayoutEffect(() => {
    const init = async () => {
      const localState = await database.localStorage.get(key);
      if (localState !== null) {
        _setState(localState as T);
      } else {
        _setState(initState);
      }
    };
    init();
  }, []);

  const setState = useCallback(
    (newState: T | ((currentState: T) => T)) => {
      if (typeof newState === 'function') {
        const setFunc = (currentState: T) => {
          const newRes = (newState as (currentState: T) => T)(currentState);
          database.localStorage.set(key, newRes);
          return newRes;
        };
        _setState(setFunc);
      } else {
        _setState(newState);
        database.localStorage.set(key, newState);
      }
    },
    [key],
  );

  return [state as T | undefined, setState] as const;
};

export default useStorageState;
