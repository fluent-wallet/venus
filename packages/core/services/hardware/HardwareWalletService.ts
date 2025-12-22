import type { Database } from '@core/database';
import type { Account } from '@core/database/models/Account';
import type { Address } from '@core/database/models/Address';
import type { Network } from '@core/database/models/Network';
import type { Vault } from '@core/database/models/Vault';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import type { HardwareAccount, HardwareConnectOptions, HardwareOperationOptions, IBSIMWallet, IHardwareWallet } from '@core/types';
import { NetworkType } from '@core/types';
import { toChecksum } from '@core/utils/account';
import { convertHexToBase32 } from '@core/utils/address';
import { Q } from '@nozbe/watermelondb';
import { inject, injectable } from 'inversify';
import type { BackupSeedParams, RestoreSeedParams } from 'modules/BSIM/src';

export type ConnectAndSyncResult = {
  accounts: HardwareAccount[];
  deviceId?: string;
};

@injectable()
export class HardwareWalletService {
  @inject(HardwareWalletRegistry)
  private readonly hardwareRegistry!: HardwareWalletRegistry;

  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  async connectAndSync(type: string, options?: HardwareConnectOptions): Promise<ConnectAndSyncResult> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceId = options?.deviceIdentifier;

    const adapter = this.resolveAdapter(type, deviceId);

    await adapter.connect(options);

    let accounts = await this.listAccounts(adapter);

    if (accounts.length === 0) {
      await this.deriveFirstAccount(adapter);
      accounts = await this.listAccounts(adapter);
    }

    return { accounts, deviceId };
  }

  async syncDerivedAccounts(vaultId: string, targetIndex: number): Promise<void> {
    if (!Number.isInteger(targetIndex) || targetIndex < 0) {
      throw new Error(`targetIndex must be a non-negative integer.`);
    }

    const vault = await this.findVault(vaultId);
    if (vault.type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error('syncDerivedAccounts only supports BSIM vaults.');
    }
    const accountGroup = await vault.getAccountGroup();
    const networks = await this.database.get<Network>(TableName.Network).query().fetch();
    if (!networks.length) {
      throw new Error('No networks configured.');
    }

    const adapter = this.resolveAdapter(HARDWARE_WALLET_TYPES.BSIM, vault.hardwareDeviceId ?? undefined);

    const existingAccounts = await accountGroup.accounts.extend(Q.sortBy('index', Q.asc)).fetch();
    const existingIndexSet = new Set(existingAccounts.map((account) => account.index));

    const missingIndexes: number[] = [];
    for (let idx = 0; idx <= targetIndex; idx += 1) {
      if (!existingIndexSet.has(idx)) {
        missingIndexes.push(idx);
      }
    }

    if (missingIndexes.length === 0) {
      return;
    }
    const targetAccount = await adapter.deriveAccount(targetIndex, NetworkType.Ethereum);

    const preparedAccounts: Account[] = [];
    const preparedAddresses: Address[] = [];

    for (const index of missingIndexes) {
      const hw = index === targetIndex ? targetAccount : await adapter.deriveAccount(index, NetworkType.Ethereum);

      const nickname = `BSIM Account - ${existingAccounts.length + preparedAccounts.length + 1}`;
      const account = this.database.get<Account>(TableName.Account).prepareCreate((record) => {
        record.nickname = nickname;
        record.index = index;
        record.hidden = false;
        record.selected = false;
        record.accountGroup.set(accountGroup);
      });

      const addressRecords = await Promise.all(
        networks.map(async (network) => {
          const assetRule = await network.defaultAssetRule;
          if (!assetRule) {
            throw new Error(`[HardwareWalletService] Missing default asset rule for network ${network.id}`);
          }

          const checksum = toChecksum(hw.address);
          return this.database.get<Address>(TableName.Address).prepareCreate((record) => {
            record.account.set(account);
            record.network.set(network);
            record.assetRule.set(assetRule);
            record.hex = checksum;
            record.base32 = network.networkType === NetworkType.Conflux ? convertHexToBase32(checksum, network.netId) : checksum;
          });
        }),
      );

      preparedAccounts.push(account);
      preparedAddresses.push(...addressRecords);
    }

    await this.database.write(async () => {
      await this.database.batch(...preparedAccounts, ...preparedAddresses);
    });
  }

  async runUpdatePin(vaultId: string, options?: HardwareOperationOptions): Promise<'ok'> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect(options?.signal ? { deviceIdentifier, signal: options.signal } : { deviceIdentifier });
    return options ? adapter.updateBpin(options) : adapter.updateBpin();
  }

  async runBackupSeed(vaultId: string, params: BackupSeedParams, options?: HardwareOperationOptions): Promise<string> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect(options?.signal ? { deviceIdentifier, signal: options.signal } : { deviceIdentifier });
    return options ? adapter.backupSeed(params, options) : adapter.backupSeed(params);
  }

  async runRestoreSeed(vaultId: string, params: RestoreSeedParams, options?: HardwareOperationOptions): Promise<'ok'> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect(options?.signal ? { deviceIdentifier, signal: options.signal } : { deviceIdentifier });
    return options ? adapter.restoreSeed(params, options) : adapter.restoreSeed(params);
  }

  private resolveAdapter(type: string, hardwareId?: string): IHardwareWallet {
    const preferred = hardwareId ? this.hardwareRegistry.get(type, hardwareId) : undefined;
    const fallback = this.hardwareRegistry.get(type);
    const adapter = preferred ?? fallback;

    if (!adapter) {
      throw new Error(`No adapter is registered for type ${type}`);
    }

    return adapter;
  }

  private async listAccounts(adapter: IHardwareWallet): Promise<HardwareAccount[]> {
    return await adapter.listAccounts(NetworkType.Ethereum);
  }

  private async deriveFirstAccount(adapter: IHardwareWallet): Promise<void> {
    await adapter.deriveAccount(0, NetworkType.Ethereum);
  }

  private async findVault(vaultId: string): Promise<Vault> {
    try {
      return await this.database.get<Vault>(TableName.Vault).find(vaultId);
    } catch {
      throw new Error(`Vault ${vaultId} not found.`);
    }
  }

  private async resolveBSIMAdapterForVault(vaultId: string): Promise<{ adapter: IBSIMWallet; deviceIdentifier: string }> {
    const vault = await this.findVault(vaultId);

    if (vault.type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error('[HardwareWalletService] Only BSIM vaults support this operation.');
    }

    const deviceIdentifier = vault.hardwareDeviceId ?? null;
    if (!deviceIdentifier || deviceIdentifier.trim() === '') {
      throw new Error('[HardwareWalletService] Missing hardwareDeviceId for BSIM vault.');
    }

    const adapter = this.resolveAdapter(HARDWARE_WALLET_TYPES.BSIM, deviceIdentifier);

    if (adapter.getCapabilities().type !== 'bsim') {
      throw new Error('[HardwareWalletService] Adapter does not support BSIM capabilities.');
    }

    return { adapter: adapter as IBSIMWallet, deviceIdentifier };
  }
}
