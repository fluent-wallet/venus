import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import { VaultService } from '@core/services/vault';
import { HardwareSigner, SoftwareSigner } from '@core/signers';
import type { ISigner } from '@core/types';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { inject, injectable } from 'inversify';

@injectable()
export class SigningService {
  @inject(SERVICE_IDENTIFIER.DB)
  private readonly database!: Database;

  @inject(VaultService)
  private readonly vaultService!: VaultService;

  @inject(HardwareWalletRegistry)
  private readonly hardwareRegistry!: HardwareWalletRegistry;

  async getSigner(accountId: string, addressId: string): Promise<ISigner> {
    const account = await this.findAccount(accountId);
    const address = await this.findAddress(addressId);
    this.assertOwnership(account, address);

    const accountGroup = await account.accountGroup.fetch();
    const vault = await accountGroup.vault.fetch();

    if (vault.type === VaultType.BSIM) {
      return this.resolveHardwareSigner(account, address, vault.hardwareDeviceId ?? undefined);
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

  private async resolveHardwareSigner(account: Account, address: Address, hardwareId?: string): Promise<HardwareSigner> {
    const adapter = this.hardwareRegistry.get(HARDWARE_WALLET_TYPES.BSIM, hardwareId);
    if (!adapter) {
      throw new Error('No BSIM hardware wallet adapter is registered.');
    }

    const network = await address.network.fetch();
    if (!network) {
      throw new Error('Address has no associated network.');
    }

    const hardwareAccount = await adapter.deriveAccount(account.index, network.networkType);
    if (!hardwareAccount.derivationPath) {
      throw new Error('Hardware account derivation path is missing.');
    }

    if (hardwareAccount.chainType !== network.networkType) {
      throw new Error('Hardware account chain mismatch.');
    }

    return new HardwareSigner({
      wallet: adapter,
      derivationPath: hardwareAccount.derivationPath,
      chainType: hardwareAccount.chainType,
    });
  }
}
