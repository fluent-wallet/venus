import { injectable, inject } from 'inversify';
import { container } from '../configs';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import { CreateAccountMethod } from './createAccount';
import { CreateVaultMethod } from './createVault';

@injectable()
export class Methods {
  @inject(GetDecryptedVaultDataMethod) private GetDecryptedVaultDataMethod!: GetDecryptedVaultDataMethod;
  public getMnemonicOfVault(...args: Parameters<GetDecryptedVaultDataMethod['getMnemonicOfVault']>) {
    return this.GetDecryptedVaultDataMethod.getMnemonicOfVault(...args);
  }
  public getPrivateKeyOfVault(...args: Parameters<GetDecryptedVaultDataMethod['getPrivateKeyOfVault']>) {
    return this.GetDecryptedVaultDataMethod.getPrivateKeyOfVault(...args);
  }
  public getPrivateKeyOfAddress(...args: Parameters<GetDecryptedVaultDataMethod['getPrivateKeyOfAddress']>) {
    return this.GetDecryptedVaultDataMethod.getPrivateKeyOfAddress(...args);
  }

  @inject(CreateAccountMethod) private CreateAccountMethod!: CreateAccountMethod;
  public createAccount(...args: Parameters<CreateAccountMethod['createAccount']>) {
    return this.CreateAccountMethod.createAccount(...args);
  }

  @inject(CreateVaultMethod) private CreateVaultMethod!: CreateVaultMethod;
  public createHDVault(...args: Parameters<CreateVaultMethod['createHDVault']>) {
    return this.CreateVaultMethod.createHDVault(...args);
  }
  public createPrivateKeyVault(...args: Parameters<CreateVaultMethod['createPrivateKeyVault']>) {
    return this.CreateVaultMethod.createPrivateKeyVault(...args);
  }
  public createPublicAddressVault(...args: Parameters<CreateVaultMethod['createPublicAddressVault']>) {
    return this.CreateVaultMethod.createPublicAddressVault(...args);
  }
  public createBSIMVault(...args: Parameters<CreateVaultMethod['createBSIMVault']>) {
    return this.CreateVaultMethod.createBSIMVault(...args);
  }
}

container.bind(Methods).to(Methods);
container.bind(GetDecryptedVaultDataMethod).to(GetDecryptedVaultDataMethod).inSingletonScope();
container.bind(CreateAccountMethod).to(CreateAccountMethod).inSingletonScope();
container.bind(CreateVaultMethod).to(CreateVaultMethod).inSingletonScope();
