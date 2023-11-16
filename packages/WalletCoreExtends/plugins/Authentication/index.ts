import * as KeyChain from 'react-native-keychain';
import CryptoToolPlugin, { CryptoToolPluginClass } from '../CryptoTool';
import { type Plugin } from '@core/WalletCore/Plugins';

const defaultOptions: KeyChain.Options = {
  service: 'com.fluent',
  authenticationPrompt: { title: 'Please authenticate in order to use', description: '' },
  accessControl: KeyChain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
};

export enum AuthenticationType {
  Biometrics = 'Biometrics',
  Passcode = 'Passcode',
  RememberMe = 'Remember_me',
  Password = 'Password',
  Unknown = 'Unknown',
}

/**
 * Unlike the default exported authCryptoTool, the authCryptoTool here requires an unexposed key to store the password itself.
 * 'PASSWORD_CRYPTO_KEY' will be replaced in build.
 */
const authCryptoTool = new CryptoToolPluginClass();
authCryptoTool.setGetPasswordMethod(() => 'PASSWORD_CRYPTO_KEY');
class AuthenticationPluginClass implements Plugin {
  name = 'Authentication' as const;
  public getPassword = async (options: KeyChain.Options = {}) => {
    const keyChainObject = await KeyChain.getGenericPassword({ ...defaultOptions, ...options });
    if (keyChainObject && keyChainObject.password) {
      return await authCryptoTool.decrypt<string>(keyChainObject.password);
    }
    return null;
  };

  // stores a user password in the secure keyChain with a specific auth type
  public setPassword: {
    (params: { authType: AuthenticationType.Biometrics }): Promise<void>;
    (params: { password: string; authType: AuthenticationType }): Promise<void>;
  } = async ({ password, authType }: { password?: string; authType: AuthenticationType }) => {
    const authOptions = {
      accessible: KeyChain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl:
        authType === AuthenticationType.Biometrics
          ? KeyChain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
          : KeyChain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    } as const;

    const _password = authType === AuthenticationType.Biometrics ? `${authCryptoTool.generateRandomString()}${new Date().getTime()}` : password;
    const encryptedPassword = await authCryptoTool.encrypt(_password);

    await KeyChain.setGenericPassword('ePayWallet-user', encryptedPassword, {
      ...defaultOptions,
      ...authOptions,
    });

    if (authType === AuthenticationType.Biometrics) {
      // If the user enables biometrics, we're trying to read the password immediately so we get the permission prompt.
      await this.getPassword();
    }
  };

  // remove the username/password combination from the secure storage.
  public resetPassword = async () => {
    const options = { service: defaultOptions.service };
    return KeyChain.resetGenericPassword(options);
  };

  /**
   * @description:validate password
   * @param {*} inputPassword user input password when authType is not biometrics
   * @param {*} authType phone supported biometry type
   * @return {*}
   */
  public validatePassword = async ({ inputPassword, authType }: { inputPassword: string; authType: AuthenticationType }) => {
    const storedPassword = await this.getPassword();
    if (!storedPassword) {
      return false;
    }

    if (authType === AuthenticationType.Biometrics) {
      return !!storedPassword;
    } else {
      return inputPassword === storedPassword;
    }
  };

  /**
   * get driver supported biometry type.
   * @returns BIOMETRY_TYPE types
   */
  getSupportedBiometryType = () => {
    return KeyChain.getSupportedBiometryType();
  };
}

const AuthenticationPlugin = new AuthenticationPluginClass();
AuthenticationPlugin.setPassword({ authType: AuthenticationType.Password, password: '12345678' });
CryptoToolPlugin.setGetPasswordMethod(AuthenticationPlugin.getPassword);

export default AuthenticationPlugin;
