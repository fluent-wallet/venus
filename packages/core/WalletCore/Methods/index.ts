import { injectable, inject } from 'inversify';
import { type Account } from '../../database/models/Account';
import { type Vault } from '../../database/models/Vault';
import { type Address } from '../../database/models/Address';
import { container } from '../configs';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import { AddAccountMethod, type Params as AddAccountParams } from './addAccount';
import { CreateVaultMethod } from './createVault';
import { AccountMethod } from './accountMethod';
import { AccountGroupMethod } from './accountGroupMethod';

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

  @inject(AddAccountMethod) private AddAccountMethod!: AddAccountMethod;
  public addAccount(params: AddAccountParams & { vault: Vault }, prepareCreate: true): Promise<(Account | Address)[]>;
  public addAccount(params: AddAccountParams): Promise<Account>;
  public addAccount(...args: Parameters<AddAccountMethod['addAccount']>) {
    return this.AddAccountMethod.addAccount(...args) as any;
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

  @inject(AccountMethod) private AccountMethod!: AccountMethod;
  public updateAccountNickName(...args: Parameters<AccountMethod['updateAccountNickName']>) {
    return this.AccountMethod.updateAccountNickName(...args);
  }
  public changeAccountHidden(...args: Parameters<AccountMethod['changeAccountHidden']>) {
    return this.AccountMethod.changeAccountHidden(...args);
  }
  public prepareChangeAccountHidden(...args: Parameters<AccountMethod['prepareChangeAccountHidden']>) {
    return this.AccountMethod.prepareChangeAccountHidden(...args);
  }
  public selectAccount(...args: Parameters<AccountMethod['selectAccount']>) {
    return this.AccountMethod.selectAccount(...args);
  }

  @inject(AccountGroupMethod) private AccountGroupMethod!: AccountGroupMethod;
  public updateAccountGroupNickName(...args: Parameters<AccountGroupMethod['updateAccountGroupNickName']>) {
    return this.AccountGroupMethod.updateAccountGroupNickName(...args);
  }
  public changeAccountGroupHidden(...args: Parameters<AccountGroupMethod['changeAccountGroupHidden']>) {
    return this.AccountGroupMethod.changeAccountGroupHidden(...args);
  }
  public getAccountGroupAccountByIndex(...args: Parameters<AccountGroupMethod['getAccountGroupAccountByIndex']>) {
    return this.AccountGroupMethod.getAccountGroupAccountByIndex(...args);
  }
  public getAccountGroupLastAccountIndex(...args: Parameters<AccountGroupMethod['getAccountGroupLastAccountIndex']>) {
    return this.AccountGroupMethod.getAccountGroupLastAccountIndex(...args);
  }
}

container.bind(Methods).to(Methods);
container.bind(GetDecryptedVaultDataMethod).to(GetDecryptedVaultDataMethod).inSingletonScope();
container.bind(AddAccountMethod).to(AddAccountMethod).inSingletonScope();
container.bind(CreateVaultMethod).to(CreateVaultMethod).inSingletonScope();
container.bind(AccountMethod).to(AccountMethod).inSingletonScope();
container.bind(AccountGroupMethod).to(AccountGroupMethod).inSingletonScope();
