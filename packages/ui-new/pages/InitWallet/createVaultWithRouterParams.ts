import { Mnemonic } from 'ethers';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { type RootStackParamList } from '@router/configs';

const createVaultWithRouterParams = async (args: RootStackParamList['Biometrics'], password?: string) => {
  const type =
    args?.type === 'importExistWallet'
      ? Mnemonic.isValidMnemonic(args?.value ?? '')
        ? 'SeedPhrase'
        : 'PrivateKey'
      : args?.type === 'connectBSIM'
        ? 'BSIM'
        : 'SeedPhrase';

  try {
    if (args?.type === 'importExistWallet' && !args?.value) {
      throw new Error('Create vault failed: invalid value');
    }

    if (args?.type === 'importExistWallet') {
      if (type === 'PrivateKey') {
        await methods.createPrivateKeyVault(args.value!, password);
      } else {
        await methods.createHDVault(args.value, password);
      }
    } else if (args?.type === 'connectBSIM') {
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
      type: 'failed',
    });
    return false;
  }
};

export default createVaultWithRouterParams;
