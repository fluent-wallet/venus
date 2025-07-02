import type { Vault } from '@core/database/models/Vault';
import type { IKeyring } from '../Keyring/types';
import type { ChainFamily, IEncodedTxMap } from '../Chains/types';

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
  signTransaction<T extends ChainFamily>(tx: IEncodedTxMap[T], chain: T): Promise<any>;
}

export type SoftwareSignerFactory = (params: SoftwareSignerFactoryParams) => Promise<ISigner>;
