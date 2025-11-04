import { inject, injectable } from 'inversify';
import { Q } from '@nozbe/watermelondb';

import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import type { Database } from '@core/database';
import TableName from '@core/database/TableName';
import type { Account } from '@core/database/models/Account';
import type { Address as AddressModel } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import VaultType from '@core/database/models/Vault/VaultType';
import type { Address } from '@core/types';

import type { IAccount } from './types';

@injectable()
export class AccountService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  async getCurrentAccount(): Promise<IAccount | null> {
    const account = await this.getCurrentAccountModel();
    if (!account) {
      return null;
    }
    return this.toInterface(account);
  }

  async switchAccount(accountId: string): Promise<void> {
    const targetAccount = await this.database.get<Account>(TableName.Account).find(accountId);

    await this.database.write(async () => {
      if (targetAccount.selected) {
        return;
      }

      const currentlySelected = await this.database.get<Account>(TableName.Account).query(Q.where('selected', true)).fetch();

      const operations = [
        ...currentlySelected.map((account) =>
          account.prepareUpdate((record) => {
            record.selected = false;
          }),
        ),
        targetAccount.prepareUpdate((record) => {
          record.selected = true;
        }),
      ];

      if (operations.length > 0) {
        await this.database.batch(...operations);
      }
    });
  }

  private async getCurrentAccountModel(): Promise<Account | null> {
    const accounts = await this.database.get<Account>(TableName.Account).query(Q.where('selected', true)).fetch();

    return accounts[0] ?? null;
  }
  private async toInterface(account: Account): Promise<IAccount> {
    const [addressValue, vaultType] = await Promise.all([this.resolveCurrentAddress(account), account.getVaultType()]);
    const isHardwareWallet = vaultType === VaultType.Hardware || vaultType === VaultType.BSIM;

    return {
      id: account.id,
      nickname: account.nickname,
      address: addressValue,
      balance: '0', //  TODO: integrate AssetService to provide actual balances
      formattedBalance: '0', //  TODO: integrate AssetService to provide actual balances
      isHardwareWallet,
      vaultType,
      selected: account.selected,
      hidden: account.hidden,
    };
  }

  private async resolveCurrentAddress(account: Account): Promise<Address | null> {
    const network = await this.getSelectedNetwork();
    if (!network) {
      return null;
    }

    const address = await this.findAddressForNetwork(account, network);
    if (!address) {
      return null;
    }

    return (await address.getValue()) as Address;
  }

  private async findAddressForNetwork(account: Account, network: Network): Promise<AddressModel | undefined> {
    const addresses = await account.addresses.extend(Q.where('network_id', network.id)).fetch();
    return addresses[0];
  }

  private async getSelectedNetwork(): Promise<Network | undefined> {
    const networks = await this.database.get<Network>(TableName.Network).query(Q.where('selected', true)).fetch();

    return networks[0];
  }
}
