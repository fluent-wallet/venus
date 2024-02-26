import Methods from '@core/WalletCore/Methods';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';

const useProvider = () => {
  const currentNetwork = useCurrentNetwork()!;

  return Methods.getTxProvider(currentNetwork);
};

export default useProvider;