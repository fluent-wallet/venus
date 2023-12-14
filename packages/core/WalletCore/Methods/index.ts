/* eslint-disable @typescript-eslint/ban-types */
import { injectable, inject } from 'inversify';
import { type Account } from '../../database/models/Account';
import { type Vault } from '../../database/models/Vault';
import { type Address } from '../../database/models/Address';
import { type Asset } from '../../database/models/Asset';
import { container } from '../configs';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import { AddAccountMethod, type Params as AddAccountParams } from './addAccount';
import { CreateVaultMethod } from './createVault';
import { AccountMethod } from './accountMethod';
import { AccountGroupMethod } from './accountGroupMethod';
import { VaultMethod } from './vaultMethod';
import { NetworkMethod } from './networkMethod';
import { DatabaseMethod } from './databaseMethod';
import { TransactionMethod } from './transactionMethod';
import { TxMethod } from './txMethod';
import { AssetMethod, type AssetParams } from './assetMethod';

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

  @inject(AssetMethod) private AssetMethod!: AssetMethod;
  public createAsset(params: AssetParams, prepareCreate: true): Asset;
  public createAsset(params: AssetParams): Promise<Asset>;
  public createAsset(params: AssetParams, prepareCreate?: true) {
    return this.AssetMethod.createAsset(params, prepareCreate as true) as any;
  }
  public updateAsset(...args: Parameters<AssetMethod['updateAsset']>) {
    return this.AssetMethod.updateAsset(...args);
  }
  public prepareUpdateAsset(...args: Parameters<AssetMethod['prepareUpdateAsset']>) {
    return this.AssetMethod.prepareUpdateAsset(...args);
  }


  @inject(TransactionMethod) private TransactionMethod!: TransactionMethod;
  public getTransactionGasAndGasLimit(...args: Parameters<TransactionMethod['getGasPriceAndLimit']>) {
    return this.TransactionMethod.getGasPriceAndLimit(...args);
  }
  public sendTransaction(...args: Parameters<TransactionMethod['sendTransaction']>) {
    return this.TransactionMethod.sendTransaction(...args);
  }

  @inject(TxMethod) private TxMethod!: TxMethod;
  public createTx(...args: Parameters<TxMethod['createTx']>) {
    return this.TxMethod.createTx(...args);
  }

  [methodName: string]: any;
  public register(methodName: string, method: Function) {
    this[methodName] = method;
  }
}

container.bind(GetDecryptedVaultDataMethod).to(GetDecryptedVaultDataMethod).inSingletonScope();
container.bind(AddAccountMethod).to(AddAccountMethod).inSingletonScope();
container.bind(CreateVaultMethod).to(CreateVaultMethod).inSingletonScope();
container.bind(AccountMethod).to(AccountMethod).inSingletonScope();
container.bind(AccountGroupMethod).to(AccountGroupMethod).inSingletonScope();
container.bind(VaultMethod).to(VaultMethod).inSingletonScope();
container.bind(NetworkMethod).to(NetworkMethod).inSingletonScope();
container.bind(DatabaseMethod).to(DatabaseMethod).inSingletonScope();
container.bind(TransactionMethod).to(TransactionMethod).inSingletonScope();
container.bind(TxMethod).to(TxMethod).inSingletonScope();
container.bind(AssetMethod).to(AssetMethod).inSingletonScope();
container.bind(Methods).to(Methods).inSingletonScope();

export default container.get(Methods) as Methods;
