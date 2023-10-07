import { Platform } from 'react-native';
import * as KeyChain from 'react-native-keychain';
import { CryptoTool, cryptoTool } from './cryptoTool';

const defaultOptions: KeyChain.Options = {
  service: 'com.fluent',
  authenticationPrompt: { title: 'authentication.auth_prompt_title', description: 'auth_prompt_desc' },
};

enum AuthenticationType {
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
const authCryptoTool = new CryptoTool();
authCryptoTool.setGetPasswordMethod(() => 'PASSWORD_CRYPTO_KEY');

class Authentication {
  public getPassword = async () => {
    const keyChainObject = await KeyChain.getGenericPassword(defaultOptions);
    if (keyChainObject && keyChainObject.password) {
      return await authCryptoTool.decrypt<string>(keyChainObject.password);
    }
    return null;
  };

  // stores a user password in the secure keyChain with a specific auth type
  public setPassword = async ({ password, authType }: { password: string; authType: AuthenticationType }) => {
    const authOptions = {
      accessible: KeyChain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: authType === AuthenticationType.Biometrics ? KeyChain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET : KeyChain.ACCESS_CONTROL.DEVICE_PASSCODE,
    } as const;

    const _password = authType === AuthenticationType.Biometrics ? `${authCryptoTool.generateRandomString()}${new Date().getTime()}` : password;
    const encryptedPassword = await authCryptoTool.encrypt(_password);

    await KeyChain.setGenericPassword('fluent-user', encryptedPassword, {
      ...defaultOptions,
      ...authOptions,
    });

    if (authType === AuthenticationType.Biometrics) {
      // If the user enables biometrics, we're trying to read the password immediately so we get the permission prompt.
      if (Platform.OS === 'ios') {
        await this.getPassword();
      }
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
}

const authentication = new Authentication();
cryptoTool.setGetPasswordMethod(authentication.getPassword);
export default authentication;