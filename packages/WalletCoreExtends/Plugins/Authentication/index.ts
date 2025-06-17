import plugins, { type Plugin } from '@core/WalletCore/Plugins';
import database from '@core/database';
import { getEncryptedVaultWithBSIM } from '@core/database/models/Vault/query';
import { showBiometricsDisabledMessage } from '@pages/InitWallet/BiometricsWay';
import { getPasswordCryptoKey } from '@utils/getEnv';
import * as KeyChain from 'react-native-keychain';
import { catchError, firstValueFrom, from, Observable, of, Subject, switchMap, tap, throwError } from 'rxjs';
import CryptoToolPlugin, { CryptoToolPluginClass } from '../CryptoTool';
import { getI18n } from '@hooks/useI18n';
import { authTypeError, biometricsCanceledError, biometricsFailedError, biometricsUnknownError } from './errors';

declare module '@core/WalletCore/Plugins' {
  interface Plugins {
    Authentication: AuthenticationPluginClass;
  }
}

const defaultOptions: KeyChain.Options = {
  service: 'io.bimwallet',
  accessControl: KeyChain.ACCESS_CONTROL.BIOMETRY_ANY,
  accessible: KeyChain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  // securityLevel: KeyChain.SECURITY_LEVEL.SECURE_HARDWARE,
};

export enum AuthenticationType {
  Biometrics = 'Biometrics',
  Password = 'Password',
}

export interface PasswordRequest {
  resolve: (value: string) => void;
  reject: (error?: Error) => void;
  verify: (password: string) => Promise<boolean>;
}

export interface PasswordRequestInfo {
  type: 'PASSWORD_REQUEST';
}

/**
 * Unlike the default exported authCryptoTool, the authCryptoTool here requires an unexposed key to store the password itself.
 * 'PASSWORD_CRYPTO_KEY' will be replaced in build.
 */
const authCryptoTool = new CryptoToolPluginClass();
authCryptoTool.setGetPasswordMethod(getPasswordCryptoKey);

const cacheTime = 750; // ms
class AuthenticationPluginClass implements Plugin {
  name = 'Authentication' as const;

  private settleAuthenticationType: AuthenticationType | null = null;
  public AuthenticationType = AuthenticationType;
  private passwordRequestSubject = new Subject<PasswordRequestInfo>();
  private pendingRequest: PasswordRequest | null = null;

  private pwdCache: string | null = null;
  private getPasswordPromise: Promise<string | null> | null = null;
  private pwdCacheTimer: number | null = null;

  constructor() {
    const getSettleAuthentication = async () => {
      this.settleAuthenticationType = (await database.localStorage.get<AuthenticationType>('SettleAuthentication')) ?? null;
    };
    getSettleAuthentication();
  }

  public subPasswordRequest() {
    return this.passwordRequestSubject.asObservable();
  }

  public getPassword = async () => {
    if (this.getPasswordPromise) return this.getPasswordPromise;

    this.getPasswordPromise = firstValueFrom(this.createPasswordStream()).finally(() => {
      this.getPasswordPromise = null;
    });

    return this.getPasswordPromise;
  };

  private createPasswordStream = () => {
    if (this.pwdCache) {
      return of(this.pwdCache);
    }

    this.clearCacheTimer();

    return of(this.settleAuthenticationType).pipe(
      switchMap((type) => {
        switch (type) {
          case AuthenticationType.Biometrics:
            return this.getBiometricsPasswordStream();
          case AuthenticationType.Password:
            return this.getPasswordStream();
          default:
            return throwError(() => authTypeError());
        }
      }),
    );
  };

  private getBiometricsPasswordStream = () => {
    return from(
      KeyChain.getGenericPassword({
        ...defaultOptions,
        authenticationPrompt: {
          title: getI18n().translation.authentication.title,
        },
      }),
    ).pipe(
      tap(() => this.clearCacheTimer()),
      catchError((keychainError: Error) => {
        const message = keychainError.message;
        if (message.includes('Cancel')) {
          return throwError(() => biometricsCanceledError());
        }
        // maybe we can match more specific errors here
        showBiometricsDisabledMessage();
        return throwError(() => biometricsUnknownError(message));
      }),

      switchMap((keyChainObject) => {
        if (!keyChainObject || !keyChainObject.password) {
          this.pwdCache = null;
          return throwError(() => biometricsFailedError());
        }
        return from(authCryptoTool.decrypt<string>(keyChainObject.password)).pipe(
          tap((decryptedPassword) => {
            this.setCacheWithTimer(decryptedPassword);
          }),
        );
      }),
    );
  };

  private getPasswordStream = () => {
    return new Observable<string>((subscriber) => {
      const request: PasswordRequest = {
        resolve: (pwd: string) => {
          subscriber.next(pwd);
          subscriber.complete();
        },
        reject: (error?: Error) => {
          subscriber.error(error);
        },
        verify: this.verifyPassword,
      };

      this.pendingRequest = request;
      this.passwordRequestSubject.next({ type: 'PASSWORD_REQUEST' });
    });
  };

  public resolve({ password }: { password: string }) {
    const request = this.pendingRequest;
    if (request) {
      this.setCacheWithTimer(password);
      request.resolve(password);
      this.pendingRequest = null;
    }
  }

  public reject({ error }: { error?: Error }) {
    const request = this.pendingRequest;
    if (request) {
      this.pwdCache = null;
      request.reject(error);
      this.pendingRequest = null;
    }
  }

  private clearCacheTimer() {
    if (this.pwdCacheTimer !== null) {
      clearTimeout(this.pwdCacheTimer);
      this.pwdCacheTimer = null;
    }
  }

  private setCacheWithTimer = (password: string) => {
    this.pwdCache = password;
    this.pwdCacheTimer = setTimeout(() => {
      this.pwdCache = null;
      this.pwdCacheTimer = null;
    }, cacheTime);
  };

  // stores a user password in the secure keyChain with a specific auth type
  public setPassword: {
    (params: { authType: AuthenticationType.Biometrics }): Promise<void>;
    (params: { password: string }): Promise<void>;
  } = async ({
    password,
    authType,
  }: {
    password?: string;
    authType?: AuthenticationType;
  }) => {
    if (authType === AuthenticationType.Biometrics) {
      const encryptedPassword = await authCryptoTool.encrypt(`${authCryptoTool.generateRandomString()}${new Date().getTime()}`);

      await KeyChain.setGenericPassword('bim-wallet-user', encryptedPassword, {
        ...defaultOptions,
        authenticationPrompt: {
          title: getI18n().translation.authentication.title,
        },
      });
      this.settleAuthenticationType = AuthenticationType.Biometrics;
      await database.localStorage.set('SettleAuthentication', AuthenticationType.Biometrics);
    } else if (typeof password === 'string' && !!password) {
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
}

const AuthenticationPlugin = new AuthenticationPluginClass();
CryptoToolPlugin.setGetPasswordMethod(AuthenticationPlugin.getPassword);

export default AuthenticationPlugin;
