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
import type { BackupSeedParams, DeriveKeyParams, RestoreSeedParams } from 'modules/BSIM/src';
import { Platform } from 'react-native';
import { startBleDeviceScan, type TransportError } from 'react-native-bsim';
import { getGroupedAccountNickname } from '../account/naming';

export type ConnectAndSyncResult = {
  accounts: HardwareAccount[];
  deviceId?: string;
};

export type ConnectAndListResult = {
  accounts: HardwareAccount[];
  deviceId?: string;
};

export type BSIMBleScanResult = { deviceId: string; name: string };
export type BSIMBleScanHandle = { stop(): void };
export type BSIMBleScanOptions = { serviceUuids?: string[] };

@injectable()
export class HardwareWalletService {
  @inject(HardwareWalletRegistry)
  private readonly hardwareRegistry!: HardwareWalletRegistry;

  @inject(CORE_IDENTIFIERS.DB)
  private readonly database!: Database;

  private resolveDefaultTransport(): 'apdu' | 'ble' {
    return Platform.OS === 'ios' ? 'ble' : 'apdu';
  }

  async connectAndSync(type: string, options?: HardwareConnectOptions): Promise<ConnectAndSyncResult> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceId = options?.deviceIdentifier;

    const adapter = this.resolveAdapter(type, deviceId);

    await adapter.connect({
      transport: options?.transport ?? this.resolveDefaultTransport(),
      deviceIdentifier: deviceId,
      signal: options?.signal,
    });

    let accounts = await this.listAccounts(adapter);

    if (accounts.length === 0) {
      await this.deriveFirstAccount(adapter);
      accounts = await this.listAccounts(adapter);
    }

    return { accounts, deviceId };
  }

  /**
   * Connects to hardware and lists existing accounts WITHOUT deriving new ones.
   * Use this for "detection" flows (e.g. checking recovery mode) to avoid side effects.
   */
  async connectAndList(type: string, options?: HardwareConnectOptions): Promise<ConnectAndListResult> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceId = options?.deviceIdentifier;
    const adapter = this.resolveAdapter(type, deviceId);

    await adapter.connect({
      transport: options?.transport ?? this.resolveDefaultTransport(),
      deviceIdentifier: deviceId,
      signal: options?.signal,
    });

    const accounts = await this.listAccounts(adapter);
    return { accounts, deviceId };
  }

  startBSIMBleScan(onDevice: (device: BSIMBleScanResult) => void, onError?: (error: TransportError) => void, options?: BSIMBleScanOptions): BSIMBleScanHandle {
    return startBleDeviceScan(
      { namePrefix: 'CT', serviceUuids: options?.serviceUuids },
      (device) => onDevice({ deviceId: device.deviceId, name: device.name }),
      onError,
    );
  }

  async runUpdatePinWithConnect(type: string, connectOptions?: HardwareConnectOptions, options?: HardwareOperationOptions): Promise<'ok'> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceIdentifier = connectOptions?.deviceIdentifier;
    const adapter = this.resolveAdapter(type, deviceIdentifier);
    if (adapter.getCapabilities().type !== 'bsim') {
      throw new Error('[HardwareWalletService] Adapter does not support BSIM capabilities.');
    }

    await (adapter as IBSIMWallet).connect({
      transport: connectOptions?.transport ?? this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal ?? connectOptions?.signal,
    });

    return options ? (adapter as IBSIMWallet).updateBpin(options) : (adapter as IBSIMWallet).updateBpin();
  }

  async runRestoreSeedWithConnect(
    type: string,
    connectOptions: HardwareConnectOptions | undefined,
    params: RestoreSeedParams,
    options?: HardwareOperationOptions,
  ): Promise<'ok'> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceIdentifier = connectOptions?.deviceIdentifier;
    const adapter = this.resolveAdapter(type, deviceIdentifier);
    if (adapter.getCapabilities().type !== 'bsim') {
      throw new Error('[HardwareWalletService] Adapter does not support BSIM capabilities.');
    }

    await (adapter as IBSIMWallet).connect({
      transport: connectOptions?.transport ?? this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal ?? connectOptions?.signal,
    });

    return options ? (adapter as IBSIMWallet).restoreSeed(params, options) : (adapter as IBSIMWallet).restoreSeed(params);
  }

  async runDeriveKeyWithConnect(
    type: string,
    connectOptions: HardwareConnectOptions | undefined,
    params: DeriveKeyParams,
    options?: HardwareOperationOptions,
  ): Promise<void> {
    if (type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error(`Unsupported hardware wallet type: ${type}`);
    }

    const deviceIdentifier = connectOptions?.deviceIdentifier;
    const adapter = this.resolveAdapter(type, deviceIdentifier);
    if (adapter.getCapabilities().type !== 'bsim') {
      throw new Error('[HardwareWalletService] Adapter does not support BSIM capabilities.');
    }

    await (adapter as IBSIMWallet).connect({
      transport: connectOptions?.transport ?? this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal ?? connectOptions?.signal,
    });

    if (options) {
      await (adapter as IBSIMWallet).deriveKey(params, options);
      return;
    }
    await (adapter as IBSIMWallet).deriveKey(params);
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

    const adapter = this.resolveAdapter(HARDWARE_WALLET_TYPES.BSIM, vault.hardwareDeviceId ?? undefined);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier: vault.hardwareDeviceId ?? undefined,
    });

    const targetAccount = await adapter.deriveAccount(targetIndex, NetworkType.Ethereum);

    const preparedAccounts: Account[] = [];
    const preparedAddresses: Address[] = [];

    for (const index of missingIndexes) {
      const hw = index === targetIndex ? targetAccount : await adapter.deriveAccount(index, NetworkType.Ethereum);

      const nickname = getGroupedAccountNickname(index);
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
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return options ? adapter.updateBpin(options) : adapter.updateBpin();
  }

  async runVerifyBpin(vaultId: string, options?: HardwareOperationOptions): Promise<void> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    await adapter.verifyBpin(options);
  }

  async runGetIccid(vaultId: string, options?: HardwareOperationOptions): Promise<string> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return adapter.getIccid(options);
  }

  async runGetVersion(vaultId: string, options?: HardwareOperationOptions): Promise<string> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return adapter.getVersion(options);
  }

  async runBackupSeed(vaultId: string, params: BackupSeedParams, options?: HardwareOperationOptions): Promise<string> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return options ? adapter.backupSeed(params, options) : adapter.backupSeed(params);
  }

  async runRestoreSeed(vaultId: string, params: RestoreSeedParams, options?: HardwareOperationOptions): Promise<'ok'> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return options ? adapter.restoreSeed(params, options) : adapter.restoreSeed(params);
  }

  async runExportPubkeys(vaultId: string, options?: HardwareOperationOptions) {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return options ? adapter.exportPubkeys(options) : adapter.exportPubkeys();
  }

  async runDeriveKey(vaultId: string, params: DeriveKeyParams, options?: HardwareOperationOptions): Promise<void> {
    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });
    return options ? adapter.deriveKey(params, options) : adapter.deriveKey(params);
  }

  async deriveBsimAccounts(vaultId: string, indexes: number[], options?: HardwareOperationOptions): Promise<HardwareAccount[]> {
    const unique = Array.from(new Set(indexes)).filter((i) => Number.isInteger(i) && i >= 0);
    unique.sort((a, b) => a - b);

    if (!unique.length) return [];

    const { adapter, deviceIdentifier } = await this.resolveBSIMAdapterForVault(vaultId);
    await adapter.connect({
      transport: this.resolveDefaultTransport(),
      deviceIdentifier,
      signal: options?.signal,
    });

    const result: HardwareAccount[] = [];
    for (const index of unique) {
      result.push(await adapter.deriveAccount(index, NetworkType.Ethereum));
    }
    return result;
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

  private async resolveBSIMAdapterForVault(vaultId: string): Promise<{ adapter: IBSIMWallet; deviceIdentifier?: string }> {
    const vault = await this.findVault(vaultId);

    if (vault.type !== HARDWARE_WALLET_TYPES.BSIM) {
      throw new Error('[HardwareWalletService] Only BSIM vaults support this operation.');
    }

    const deviceIdentifier = vault.hardwareDeviceId ?? undefined;
    const adapter = this.resolveAdapter(HARDWARE_WALLET_TYPES.BSIM, deviceIdentifier);

    if (adapter.getCapabilities().type !== 'bsim') {
      throw new Error('[HardwareWalletService] Adapter does not support BSIM capabilities.');
    }

    return { adapter: adapter as IBSIMWallet, deviceIdentifier };
  }
}
