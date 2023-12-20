import * as KeyChain from 'react-native-keychain';
import { atom } from 'jotai';
import CryptoToolPlugin, { CryptoToolPluginClass } from '../CryptoTool';
import { type Plugin } from '@core/WalletCore/Plugins';
import database from '@core/database';

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    Authentication: AuthenticationPluginClass;
  }
}

const defaultOptions: KeyChain.Options = {
  service: 'com.fluent',
  authenticationPrompt: { title: 'Please authenticate in order to use', description: '' },
  accessControl: KeyChain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  accessible: KeyChain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export enum AuthenticationType {
  Biometrics = 'Biometrics',
  Password = 'Password',
}

/**
 * Unlike the default exported authCryptoTool, the authCryptoTool here requires an unexposed key to store the password itself.
 * 'PASSWORD_CRYPTO_KEY' will be replaced in build.
 */
const authCryptoTool = new CryptoToolPluginClass();
authCryptoTool.setGetPasswordMethod(() => 'PASSWORD_CRYPTO_KEY');
class AuthenticationPluginClass implements Plugin {
  name = 'Authentication' as const;

  private settleAuthenticationType: AuthenticationType | null = null;
  public AuthenticationType = AuthenticationType;

  constructor() {
    const getSettleAuthentication = async () => {
      this.settleAuthenticationType = (await database.localStorage.get<AuthenticationType>('SettleAuthentication')) ?? null;
    };
    getSettleAuthentication();
  }

  public getPassword = async (options: KeyChain.Options = {}) => {
    if (this.settleAuthenticationType === AuthenticationType.Biometrics) {
      const keyChainObject = await KeyChain.getGenericPassword({ ...defaultOptions, ...options });
      if (keyChainObject && keyChainObject.password) {
        return await authCryptoTool.decrypt<string>(keyChainObject.password);
      }
      return null;
    } else if (this.settleAuthenticationType === AuthenticationType.Password) {
      return '';
    } else {
      throw new Error('Authentication  not set');
    }
  };

  // stores a user password in the secure keyChain with a specific auth type
  public setPassword: {
    (params: { authType: AuthenticationType.Biometrics }): Promise<void>;
    (params: { password: string }): Promise<void>;
  } = async ({ password, authType }: { password?: string; authType?: AuthenticationType }) => {
    if (authType === AuthenticationType.Biometrics) {
      const encryptedPassword = await authCryptoTool.encrypt(`${authCryptoTool.generateRandomString()}${new Date().getTime()}`);

      await KeyChain.setGenericPassword('ePayWallet-user', encryptedPassword, {
        ...defaultOptions,
      });

      await database.localStorage.set('SettleAuthentication', AuthenticationType.Biometrics);

      // If the user enables biometrics, we're trying to read the password immediately so we get the permission prompt.
      await this.getPassword();
    }

    if (typeof password === 'string' && !!password) {
      this.settleAuthenticationType = AuthenticationType.Password;
      await database.localStorage.set('SettleAuthentication', AuthenticationType.Password);
    }
  };

  // remove the username/password combination from the secure storage.
  // public resetPassword = async () => {
  //   const options = { service: defaultOptions.service };
  //   return KeyChain.resetGenericPassword(options);
  // };

  // /**
  //  * @description:validate password
  //  * @param {*} inputPassword user input password when authType is not biometrics
  //  * @param {*} authType phone supported biometry type
  //  * @return {*}
  //  */
  // public validatePassword = async ({ inputPassword, authType }: { inputPassword: string; authType: AuthenticationType }) => {
  //   const storedPassword = await this.getPassword();
  //   if (!storedPassword) {
  //     return false;
  //   }

  //   if (authType === AuthenticationType.Biometrics) {
  //     return !!storedPassword;
  //   } else {
  //     return inputPassword === storedPassword;
  //   }
  // };

  /**
   * get driver supported biometry type.
   * @returns BIOMETRY_TYPE types
   */
  public getSupportedBiometryType = async () => KeyChain.getSupportedBiometryType();
}

const AuthenticationPlugin = new AuthenticationPluginClass();
CryptoToolPlugin.setGetPasswordMethod(AuthenticationPlugin.getPassword);

export default AuthenticationPlugin;
