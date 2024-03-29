import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type RootStackList } from '@router/configs';
import { showMessage } from 'react-native-flash-message';

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics'], password?: string) => {
  const type = args?.type === 'importPrivateKey' ? 'PrivateKey' : args?.type === 'BSIM' ? 'BSIM' : 'SeedPhrase';
  try {
    if (args?.type === 'importPrivateKey' && args.value) {
      await methods.createPrivateKeyVault(args.value, password);
    } else if (args?.type === 'importSeedPhrase' && args.value) {
      await methods.createHDVault(args.value, password);
    } else if (args?.type === 'BSIM') {
      await methods.createBSIMVault(await plugins.BSIM.connectBSIM(), password);
    } else {
      await methods.createHDVault(undefined, password);
    }

    return true;
  } catch (err) {
    if (plugins.Authentication.containsCancel(String(err))) {
      return;
    }
    showMessage({
      message: `Add new ${type} account failed`,
      description: String(err ?? ''),
      type: 'warning',
      duration: 3000,
    });
    return false;
  }
};

export default createVaultWithRouterParams;
