/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';

const useInAsync = <T extends (params: any) => void | Promise<any> | null | undefined>(asyncFunc: T) => {
  const [inAsync, setInAsync] = useState(false);
  const execAsync = useCallback(
    async (params: any) => {
      try {
        setInAsync(true);
        const res = await asyncFunc(params);
        setInAsync(false);
        return res;
      } catch (err) {
        setInAsync(false);
        throw err;
      }
    },
    [asyncFunc]
  ) as T;
  return { inAsync, execAsync };
};

export default useInAsync;
