import { useContext } from 'react';
import { WalletCoreContext } from '../contexts/WalletCoreContext';

export const useCore = () => {
  const core = useContext(WalletCoreContext);
  if (!core) {
    throw new Error('useCore must be used within a WalletCoreProvider');
  }
  return core;
};

export const useEventBus = () => {
  const core = useCore();
  return core.eventBus;
};

export const useAuthentication = () => {
  const core = useCore();
  return core.authentication;
};

export const useCryptoTool = () => {
  const core = useCore();
  return core.cryptoTool;
};
