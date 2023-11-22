/* eslint-disable @typescript-eslint/ban-types */
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
import { VaultMethod } from './vaultMethod';
import { NetworkMethod } from './networkMethod';
import { DatabaseMethod } from './databaseMethod';

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

  @inject(VaultMethod) private VaultMethod!: VaultMethod;
  public deleteVault(...args: Parameters<VaultMethod['deleteVault']>) {
    return this.VaultMethod.deleteVault(...args);
  }

  @inject(NetworkMethod) private NetworkMethod!: NetworkMethod;
  public createNetwork(...args: Parameters<NetworkMethod['createNetwork']>) {
    return this.NetworkMethod.createNetwork(...args);
  }
  public switchToNetwork(...args: Parameters<NetworkMethod['switchToNetwork']>) {
    return this.NetworkMethod.switchToNetwork(...args);
  }

  @inject(DatabaseMethod) private DatabaseMethod!: DatabaseMethod;
  public initDatabaseDefault(...args: Parameters<DatabaseMethod['initDatabaseDefault']>) {
    return this.DatabaseMethod.initDatabaseDefault(...args);
  }
  public resetDatabase(...args: Parameters<DatabaseMethod['resetDatabase']>) {
    return this.DatabaseMethod.resetDatabase(...args);
  }
  public clearAccountData(...args: Parameters<DatabaseMethod['clearAccountData']>) {
    return this.DatabaseMethod.clearAccountData(...args);
  }

  [methodName: string]: any;
  public register(methodName: string, method: Function) {
    this[methodName] = method;
  }
}

container.bind(Methods).to(Methods);
container.bind(GetDecryptedVaultDataMethod).to(GetDecryptedVaultDataMethod).inSingletonScope();
container.bind(AddAccountMethod).to(AddAccountMethod).inSingletonScope();
container.bind(CreateVaultMethod).to(CreateVaultMethod).inSingletonScope();
container.bind(AccountMethod).to(AccountMethod).inSingletonScope();
container.bind(AccountGroupMethod).to(AccountGroupMethod).inSingletonScope();
container.bind(VaultMethod).to(VaultMethod).inSingletonScope();
container.bind(NetworkMethod).to(NetworkMethod).inSingletonScope();
container.bind(DatabaseMethod).to(DatabaseMethod).inSingletonScope();

export default container.get(Methods) as Methods;
