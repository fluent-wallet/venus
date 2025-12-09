import { isAuthenticationCanceledError, isAuthenticationError } from '@WalletCoreExtends/Plugins/Authentication/errors';
import i18n from '@assets/i18n';
import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import type { RootStackParamList } from '@router/configs';
import { Mnemonic } from 'ethers';
import { showMessage } from 'react-native-flash-message';

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
      throw new Error(i18n.t('initWallet.error.invalidValue'));
    }

    if (args?.type === 'importExistWallet') {
      const hasSame = await methods.checkHasSameVault(args.value!);
      if (hasSame) {
        showMessage({
          message: i18n.t('initWallet.error.exist', { type: type === 'SeedPhrase' ? i18n.t('common.seedPhrase') : i18n.t('common.privateKey') }),
          type: 'failed',
        });
        return;
      }
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
    if (isAuthenticationError(err) && isAuthenticationCanceledError(err)) {
      return;
    }
    const typeMap = {
      SeedPhrase: i18n.t('common.seedPhrase'),
      PrivateKey: i18n.t('common.privateKey'),
      BSIM: 'BSIM',
    };
    showMessage({
      message: i18n.t('initWallet.error.unknown', { type: typeMap[type] }),
      description: String(err ?? ''),
      type: 'failed',
    });
    return false;
  }
};

export default createVaultWithRouterParams;
