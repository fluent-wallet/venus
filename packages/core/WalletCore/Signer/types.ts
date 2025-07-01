import type { Vault } from '@core/database/models/Vault';
import type { IKeyring } from '../Keyring/types';

export enum ChainFamily {
  EVM = 'evm',
  CFX = 'cfx',
}

export interface SoftwareSignerFactoryParams {
  vault: Vault;
  password: string;
  path?: string;
  index?: number;
  keyring: IKeyring;
}

export interface ISigner {
  getAddress(chain: ChainFamily): Promise<string>;

  // TODO update this type
  signMessageHash(messageHash: Uint8Array, chain: ChainFamily): Promise<any>;

  // TODO update this type
  signTransaction(tx: any, chain: ChainFamily): Promise<any>;
}

export type SoftwareSignerFactory = (params: SoftwareSignerFactoryParams) => Promise<ISigner>;
