/* eslint-disable @typescript-eslint/ban-types */
import { inject, injectable } from 'inversify';
import type { Account } from '../../database/models/Account';
import type { Address } from '../../database/models/Address';
import type { Asset } from '../../database/models/Asset';
import type { NetworkType } from '../../database/models/Network';
import type { Vault } from '../../database/models/Vault';
import { container } from '../configs';
import { AccountGroupMethod } from './accountGroupMethod';
import { AccountMethod } from './accountMethod';
import { AddAccountMethod, type Params as AddAccountParams } from './addAccount';
import { AppMethod } from './appMethod';
import { AssetMethod, type AssetParams } from './assetMethod';
import { CreateVaultMethod } from './createVault';
import { DatabaseMethod } from './databaseMethod';
import { GetDecryptedVaultDataMethod } from './getDecryptedVaultData';
import { NetworkMethod } from './networkMethod';
import { RequestMethod } from './requestMethod';
import { SignatureMethod } from './signatureMethod';
import { TxMethod } from './txMethod';
import { VaultMethod } from './vaultMethod';

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

  public checkHasSameVault(...args: Parameters<VaultMethod['checkHasSameVault']>) {
    return this.VaultMethod.checkHasSameVault(...args);
  }

  @inject(NetworkMethod) private NetworkMethod!: NetworkMethod;
  public createNetwork(...args: Parameters<NetworkMethod['createNetwork']>) {
    return this.NetworkMethod.createNetwork(...args);
  }
  public switchToNetwork(...args: Parameters<NetworkMethod['switchToNetwork']>) {
    return this.NetworkMethod.switchToNetwork(...args);
  }
  public updateCurrentEndpoint(...args: Parameters<NetworkMethod['updateCurrentEndpoint']>) {
    return this.NetworkMethod.updateCurrentEndpoint(...args);
  }
  public removeEndpoints(...args: Parameters<NetworkMethod['removeEndpoint']>) {
    return this.NetworkMethod.removeEndpoint(...args);
  }
  public addEndpoint(...args: Parameters<NetworkMethod['addEndpoint']>) {
    return this.NetworkMethod.addEndpoint(...args);
  }
  public checkIsValidAddress(...args: Parameters<NetworkMethod['checkIsValidAddress']>) {
    return this.NetworkMethod.checkIsValidAddress(...args);
  }
  public checkIsContractAddress(params: { networkType: NetworkType.Conflux; endpoint: string; addressValue: string }): boolean;
  public checkIsContractAddress(params: { networkType: NetworkType; endpoint: string; addressValue: string }): Promise<boolean>;
  public checkIsContractAddress(params: { networkType: NetworkType; endpoint: string; addressValue: string }) {
    return this.NetworkMethod.checkIsContractAddress(params as any) as any;
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

  @inject(TxMethod) private TxMethod!: TxMethod;
  public createTx(...args: Parameters<TxMethod['createTx']>) {
    return this.TxMethod.createTx(...args);
  }

  @inject(AppMethod) private AppMethod!: AppMethod;
  public createApp(...args: Parameters<AppMethod['createApp']>) {
    return this.AppMethod.createApp(...args);
  }
  public isAppExist(...args: Parameters<AppMethod['queryAppByIdentity']>) {
    return this.AppMethod.queryAppByIdentity(...args);
  }
  public queryAppByIdentity(...args: Parameters<AppMethod['queryAppByIdentity']>) {
    return this.AppMethod.queryAppByIdentity(...args);
  }

  @inject(RequestMethod) private RequestMethod!: RequestMethod;
  public createRequest(...args: Parameters<RequestMethod['createRequest']>) {
    return this.RequestMethod.createRequest(...args);
  }
  public getRequestById(...args: Parameters<RequestMethod['getRequestById']>) {
    return this.RequestMethod.getRequestById(...args);
  }
  public rejectAllPendingRequests(...args: Parameters<RequestMethod['rejectAllPendingRequests']>) {
    return this.RequestMethod.rejectAllPendingRequests(...args);
  }

  @inject(SignatureMethod) private SignatureMethod!: SignatureMethod;
  public createSignature(...args: Parameters<SignatureMethod['createSignature']>) {
    return this.SignatureMethod.createSignature(...args);
  }

  [methodName: string]: any;
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
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
container.bind(TxMethod).to(TxMethod).inSingletonScope();
container.bind(AssetMethod).to(AssetMethod).inSingletonScope();
container.bind(Methods).to(Methods).inSingletonScope();
container.bind(AppMethod).to(AppMethod).inSingletonScope();
container.bind(RequestMethod).to(RequestMethod).inSingletonScope();
container.bind(SignatureMethod).to(SignatureMethod).inSingletonScope();

export default container.get(Methods) as Methods;
