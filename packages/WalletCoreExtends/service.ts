import { SERVICE_IDENTIFIER } from '../core/WalletCore/service';
import type { IAuthenticationServer } from './Plugins/Authentication/authenticationServer';

export const EXTENDS_SERVICE_IDENTIFIER = {
  EXTENDS_CORE: 'EXTENDS_CORE',

  /**
   * Authentication
   */
  AUTHENTICATION: 'AUTHENTICATION',
} as const;

export interface ExtendsServiceMap {
  [EXTENDS_SERVICE_IDENTIFIER.AUTHENTICATION]: IAuthenticationServer;
}

export const ALL_SERVICE_IDENTIFIERS = {
  ...SERVICE_IDENTIFIER,
  ...EXTENDS_SERVICE_IDENTIFIER,
};
