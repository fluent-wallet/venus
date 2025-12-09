import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { VaultService } from '@core/services/vault';
import { SoftwareSigner } from '@core/signers';
import type { ISigner } from '@core/types';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';

@injectable()
export class SigningService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  @inject(VaultService)
  private readonly vaultService!: VaultService;

  async getSigner(accountId: string, addressId: string): Promise<ISigner> {
    const account = await this.findAccount(accountId);
    const address = await this.findAddress(addressId);
    this.assertOwnership(account, address);

    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();

    if (vault.type === VaultType.BSIM) {
      throw new Error('Hardware wallet signing is not yet implemented. ');
    }

    if (vault.type === VaultType.HierarchicalDeterministic || vault.type === VaultType.PrivateKey) {
      const privateKey = await this.vaultService.getPrivateKey(vault.id, address.id);
      return new SoftwareSigner(privateKey);
    }

    throw new Error(`Vault type ${vault.type} does not support signing via SigningService.`);
  }

  private async findAccount(accountId: string): Promise<Account> {
    try {
      return await this.database.get<Account>(TableName.Account).find(accountId);
    } catch {
      throw new Error(`Account ${accountId} not found.`);
    }
  }

  private async findAddress(addressId: string): Promise<Address> {
    try {
      return await this.database.get<Address>(TableName.Address).find(addressId);
    } catch {
      throw new Error(`Address ${addressId} not found.`);
    }
  }

  private assertOwnership(account: Account, address: Address): void {
    if (address.account.id !== account.id) {
      throw new Error('Address does not belong to the provided account.');
    }
  }
}
