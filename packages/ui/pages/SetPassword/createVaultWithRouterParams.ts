import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type RootStackList } from '@router/configs';

const createVaultWithRouterParams = async (args?: RootStackList['Biometrics']) => {
  if (args?.type === 'importPrivateKey' && args.value) {
    return await methods.createPrivateKeyVault(args.value);
  }
  if (args?.type === 'importSeedPhrase' && args.type) {
    return await methods.createHDVault(args.value);
  }
  if (args?.type === 'BSIM') {
    return await methods.createBSIMVault(await plugins.BSIM.connectBSIM());
  }

  return await methods.createHDVault();
};

export default createVaultWithRouterParams;
