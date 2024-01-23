import * as KeyChain from 'react-native-keychain';
import { Subject } from 'rxjs';
import CryptoToolPlugin, { CryptoToolPluginClass } from '../CryptoTool';
import plugins, { type Plugin } from '@core/WalletCore/Plugins';
import database from '@core/database';
import { getEncryptedVaultWithBSIM } from '@core/database/models/Vault/query';
// import { showBiometricsDisabledMessage } from '@pages/SetPassword/Biometrics';
import { getPasswordCryptoKey } from '@utils/getEnv';

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
export interface PasswordRequest {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
  verify: (password: string) => Promise<boolean>;
}

/**
 * Unlike the default exported authCryptoTool, the authCryptoTool here requires an unexposed key to store the password itself.
 * 'PASSWORD_CRYPTO_KEY' will be replaced in build.
 */
const authCryptoTool = new CryptoToolPluginClass();
authCryptoTool.setGetPasswordMethod(getPasswordCryptoKey);

class AuthenticationPluginClass implements Plugin {
  name = 'Authentication' as const;

  private settleAuthenticationType: AuthenticationType | null = null;
  public AuthenticationType = AuthenticationType;
  public passwordRequestSubject = new Subject<PasswordRequest>();
  private pwdCache: { password: string; cacheTime: number } | null = null;
  private getPasswordPromise: Promise<string | null> | null = null;

  constructor() {
    const getSettleAuthentication = async () => {
      this.settleAuthenticationType = (await database.localStorage.get<AuthenticationType>('SettleAuthentication')) ?? null;
    };
    getSettleAuthentication();
  }

  public getPassword = async (options: KeyChain.Options = {}) => {
    if (this.settleAuthenticationType === AuthenticationType.Biometrics) {
      try {
        const keyChainObject = await KeyChain.getGenericPassword({ ...defaultOptions, ...options });
        if (keyChainObject && keyChainObject.password) {
          return await authCryptoTool.decrypt<string>(keyChainObject.password);
        }
        throw new Error('Biometrics getPassword failed.');
      } catch (err) {
        const errString = JSON.stringify((err as any)?.message ?? err);
        if (containsCancel(errString)) {
          throw new Error('User canceled biometrics.');
        } else {
          // showBiometricsDisabledMessage();
          throw new Error('Biometrics not enable.');
        }
      }
    } else if (this.settleAuthenticationType === AuthenticationType.Password) {
      if (this.getPasswordPromise) return this.getPasswordPromise;
      this.getPasswordPromise = new Promise<string>((_resolve, _reject) => {
        if (!this.pwdCache || Date.now() - this.pwdCache.cacheTime > 0.75 * 1000) {
          this.passwordRequestSubject.next({
            resolve: (pwd: string) => {
              this.pwdCache = {
                cacheTime: Date.now(),
                password: pwd,
              };
              _resolve(pwd);
            },
            reject: (err: any) => {
              this.pwdCache = null;
              _reject(err);
            },
            verify: this.verifyPassword,
          });
        } else {
          _resolve(this.pwdCache.password);
          this.pwdCache.cacheTime = Date.now();
        }
      }).finally(() => {
        this.getPasswordPromise = null;
      });
      return this.getPasswordPromise;
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

      this.settleAuthenticationType = AuthenticationType.Biometrics;
      await database.localStorage.set('SettleAuthentication', AuthenticationType.Biometrics);

      // If the user enables biometrics, we're trying to read the password immediately so we get the permission prompt.
      await this.getPassword();
    }

    if (typeof password === 'string' && !!password) {
      this.settleAuthenticationType = AuthenticationType.Password;
      await database.localStorage.set('SettleAuthentication', AuthenticationType.Password);
    }
  };

  public getSupportedBiometryType = async () => KeyChain.getSupportedBiometryType();

  public verifyPassword = async (password: string) => {
    const vaults = await getEncryptedVaultWithBSIM();
    if (!vaults?.length) {
      throw new Error('Wallet must have at least one pk or hd or BSIM vault in Password AuthenticationType');
    }
    try {
      const vaultData = vaults[0].data!;
      const res = await plugins.CryptoTool.decrypt(vaultData, password);
      return !!res;
    } catch (err) {
      return false;
    }
  };

  public containsCancel = containsCancel;
}

const AuthenticationPlugin = new AuthenticationPluginClass();
CryptoToolPlugin.setGetPasswordMethod(AuthenticationPlugin.getPassword);

export default AuthenticationPlugin;


const pattern = /cancel|\u53d6\u6d88/i; 
export function containsCancel(str: string): boolean {
  return pattern.test(str);
}