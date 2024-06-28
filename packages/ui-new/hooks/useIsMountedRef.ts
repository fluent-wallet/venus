import { useEffect, useRef } from 'react';

const useIsMountedRef = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
};

export default useIsMountedRef;
