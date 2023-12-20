import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type RootStackList } from '@router/configs';

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics'], password?: string) => {
  try {
    if (args?.type === 'importPrivateKey' && args.value) {
      return await methods.createPrivateKeyVault(args.value, password);
    }
    if (args?.type === 'importSeedPhrase' && args.value) {
      return await methods.createHDVault(args.value, password);
    }
    if (args?.type === 'BSIM') {
      return await methods.createBSIMVault(await plugins.BSIM.connectBSIM());
    }

    return await methods.createHDVault(undefined, password);
  } catch (err) {}
};

export default createVaultWithRouterParams;
