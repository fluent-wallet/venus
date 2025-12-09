import database from '@core/database';
import { getEncryptedVaultWithBSIM } from '@core/database/models/Vault/query';
import type { EventBus } from '@core/WalletCore/Events';
import type { ICryptoTool } from '@core/WalletCore/Plugins/CryptoTool/interface';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { getI18n } from '@hooks/useI18n';
import { showBiometricsDisabledMessage } from '@pages/InitWallet/BiometricsWay';
import { inject, injectable } from 'inversify';
import * as KeyChain from 'react-native-keychain';
import { catchError, firstValueFrom, from, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { CryptoToolServer } from '../CryptoTool/cryptoToolServer';
import { authTypeError, biometricsCanceledError, biometricsFailedError, biometricsUnknownError } from './errors';

export const AUTHENTICATION_PASSWORD_REQUEST = 'auth/password-request';

declare module '../../../core/WalletCore/Events/eventTypes.ts' {
  interface EventMap {
    [AUTHENTICATION_PASSWORD_REQUEST]: undefined;
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

export interface IAuthenticationServer {
  getPassword: () => Promise<string | null>;
  resolve: (params: { password: string }) => void;
  reject: (params: { error?: Error }) => void;
  setPassword: (params: { authType?: AuthenticationType; password?: string }) => Promise<void>;
  getSupportedBiometryType: () => Promise<KeyChain.BIOMETRY_TYPE | null>;
  verifyPassword: (password: string) => Promise<boolean>;
  AuthenticationType: typeof AuthenticationType;
}

const cacheTime = 750; // ms

@injectable()
export class AuthenticationServer implements IAuthenticationServer {
  name = 'Authentication' as const;

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  private eventBus!: EventBus;
  private settleAuthenticationType: AuthenticationType | null = null;
  public AuthenticationType = AuthenticationType;
  private pendingRequest: PasswordRequest | null = null;

  private pwdCache: string | null = null;
  private getPasswordPromise: Promise<string | null> | null = null;
  private pwdCacheTimer: number | null = null;

  private biometricCryptoTool = new CryptoToolServer();

  @inject(SERVICE_IDENTIFIER.CRYPTO_TOOL)
  private authCryptoTool!: ICryptoTool;

  constructor() {
    const getSettleAuthentication = async () => {
      this.settleAuthenticationType = (await database.localStorage.get<AuthenticationType>('SettleAuthentication')) ?? null;
    };
    getSettleAuthentication();
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
        return from(this.biometricCryptoTool.decrypt<string>(keyChainObject.password)).pipe(
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
      this.eventBus.dispatch(AUTHENTICATION_PASSWORD_REQUEST);
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
  public setPassword = async ({ password, authType }: { password?: string; authType?: AuthenticationType }) => {
    if (authType === AuthenticationType.Biometrics) {
      const encryptedPassword = await this.biometricCryptoTool.encrypt(`${this.biometricCryptoTool.generateRandomString()}${Date.now()}`);

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
      const res = await this.authCryptoTool.decrypt(vaultData, password);
      return !!res;
    } catch (err) {
      return false;
    }
  };
}
