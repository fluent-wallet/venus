import { useState, useLayoutEffect, PropsWithChildren } from 'react';

interface Props {
  delay?: number;
}

const Delay: React.FC<PropsWithChildren<Props>> = ({ delay = 100, children }) => {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const timer = setTimeout(() => setReady(true), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;
  return <>{children}</>;
};

export default Delay;
