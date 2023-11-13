import { Container, injectable, inject } from 'inversify';
import { Plugins, PluginsSymbol } from '../plugins';
import { type createAccountMethod } from './createAccount';
import { getDecryptedVaultDataMethod } from './getDecryptedVaultData';

export interface MethodsInterface {
  createAccount(): Promise<void>;
}

@injectable()
export class Methods {
  @inject('createAccount') createAccount!: createAccountMethod['createAccount'];
  @inject('getMnemonicOfVault') getMnemonicOfVault!: getDecryptedVaultDataMethod['getMnemonicOfVault'];
  @inject('getMnemonicOfAccountGroup') getMnemonicOfAccountGroup!: getDecryptedVaultDataMethod['getMnemonicOfAccountGroup'];
  @inject('getPrivateKeyOfVault') getPrivateKeyOfVault!: getDecryptedVaultDataMethod['getPrivateKeyOfVault'];
  @inject('getPrivateKeyOfAccount') getPrivateKeyOfAccount!: getDecryptedVaultDataMethod['getPrivateKeyOfAccount'];
}

const methodsContainer = new Container({ defaultScope: 'Singleton' });
methodsContainer.bind<typeof Plugins>(PluginsSymbol).toConstantValue(Plugins);
