/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef, useEffect } from 'react';

const useInAsync = <T extends (params: any) => void | Promise<any> | null | undefined>(asyncFunc: T) => {
  const refAsyncFunc = useRef(asyncFunc);
  useEffect(() => {
    refAsyncFunc.current = asyncFunc;
  }, [asyncFunc]);

  const [inAsync, setInAsync] = useState(false);
  const execAsync = useCallback(async (...params: any) => {
    try {
      setInAsync(true);
      const res = await refAsyncFunc.current(...params);
      setInAsync(false);
      return res;
    } catch (err) {
      setInAsync(false);
      throw err;
    }
  }, []) as T;
  return { inAsync, execAsync };
};

export default useInAsync;
