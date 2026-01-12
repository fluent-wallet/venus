import 'reflect-metadata';

import { mockDatabase } from '@core/__tests__/mocks';
import type { Vault } from '@core/database/models/Vault';
import VaultType from '@core/database/models/Vault/VaultType';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { HARDWARE_WALLET_TYPES } from '@core/hardware/bsim/constants';
import { HardwareWalletRegistry } from '@core/hardware/HardwareWalletRegistry';
import type {
  ChainType,
  HardwareAccount,
  HardwareConnectOptions,
  HardwareOperationOptions,
  HardwareSignResult,
  IBSIMWallet,
  IHardwareWallet,
  SigningContext,
} from '@core/types';
import { NetworkType } from '@core/types';
import type { Database } from '@nozbe/watermelondb';
import { Container } from 'inversify';
import type { BackupSeedParams, DeriveKeyParams, RestoreSeedParams } from 'modules/BSIM/src';
import { Platform } from 'react-native';
import { startBleDeviceScan } from 'react-native-bsim';
import { HardwareWalletService } from './HardwareWalletService';

const createBSIMWalletAdapter = (params: { id: string }): jest.Mocked<IBSIMWallet> => ({
  id: params.id,
  type: 'bsim',
  connect: jest.fn(async (_options?: HardwareConnectOptions) => undefined),
  disconnect: jest.fn(async () => undefined),
  isConnected: jest.fn(async () => true),
  listAccounts: jest.fn(async (_chainType: ChainType): Promise<HardwareAccount[]> => []),
  deriveAccount: jest.fn(
    async (index: number, _chainType: ChainType): Promise<HardwareAccount> => ({
      index,
      address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      chainType: NetworkType.Ethereum,
      derivationPath: `m/44'/60'/0'/0/${index}`,
    }),
  ),
  deriveAddress: jest.fn(async (_path: string, _chainType: ChainType) => '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
  sign: jest.fn(async (_context: SigningContext): Promise<HardwareSignResult> => {
    throw new Error('not used');
  }),
  getCapabilities: jest.fn(() => ({ type: 'bsim' })),
  verifyBpin: jest.fn(async () => undefined),
  updateBpin: jest.fn(async () => 'ok' as const),
  getIccid: jest.fn(async () => 'icc-ignored'),
  getVersion: jest.fn(async () => '1.0.0'),
  backupSeed: jest.fn(async (_params: BackupSeedParams, _options?: HardwareOperationOptions) => '0xbackup'),
  restoreSeed: jest.fn(async (_params: RestoreSeedParams, _options?: HardwareOperationOptions) => 'ok' as const),
  exportPubkeys: jest.fn(async () => []),
  deriveKey: jest.fn(async (_params: DeriveKeyParams, _options?: HardwareOperationOptions) => undefined),
});

const createAdapter = (params: { id: string }): jest.Mocked<IHardwareWallet> => ({
  id: params.id,
  type: 'bsim',
  connect: jest.fn(async (_options?: HardwareConnectOptions) => undefined),
  disconnect: jest.fn(async () => undefined),
  isConnected: jest.fn(async () => true),
  listAccounts: jest.fn(async (_chainType: ChainType): Promise<HardwareAccount[]> => []),
  deriveAccount: jest.fn(
    async (index: number, _chainType: ChainType): Promise<HardwareAccount> => ({
      index,
      address: '0xdeadbeef',
      chainType: NetworkType.Ethereum,
      derivationPath: `m/44'/60'/0'/0/${index}`,
    }),
  ),
  deriveAddress: jest.fn(async (_path: string, _chainType: ChainType) => '0xdeadbeef'),
  sign: jest.fn(async (_context: SigningContext): Promise<HardwareSignResult> => {
    throw new Error('not used');
  }),
  getCapabilities: jest.fn(() => ({ type: 'bsim' })),
});

jest.mock('react-native-bsim', () => {
  const actual = jest.requireActual('react-native-bsim');
  return { ...actual, startBleDeviceScan: jest.fn() };
});

describe('HardwareWalletService', () => {
  let container: Container;
  let registry: HardwareWalletRegistry;
  let service: HardwareWalletService;

  beforeEach(() => {
    container = new Container({ defaultScope: 'Singleton' });
    const database = mockDatabase();
    container.bind<Database>(CORE_IDENTIFIERS.DB).toConstantValue(database);

    container.bind(HardwareWalletRegistry).toSelf().inSingletonScope();
    container.bind(HardwareWalletService).toSelf().inSingletonScope();

    registry = container.get(HardwareWalletRegistry);
    service = container.get(HardwareWalletService);
  });

  afterEach(() => {
    container.unbindAll();
  });

  it('derives the first account when listAccounts returns empty array', async () => {
    const adapter = createAdapter({ id: 'adapter' });

    const firstAccount: HardwareAccount = {
      index: 0,
      address: '0xdeadbeef',
      chainType: NetworkType.Ethereum,
      derivationPath: "m/44'/60'/0'/0/0",
    };

    adapter.listAccounts.mockResolvedValueOnce([]).mockResolvedValueOnce([firstAccount]);

    registry.register(HARDWARE_WALLET_TYPES.BSIM, undefined, adapter);

    const result = await service.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier: 'ble-001' });

    expect(adapter.connect).toHaveBeenCalledWith({
      transport: Platform.OS === 'ios' ? 'ble' : 'apdu',
      deviceIdentifier: 'ble-001',
      signal: undefined,
    });
    expect(adapter.listAccounts).toHaveBeenNthCalledWith(1, NetworkType.Ethereum);
    expect(adapter.deriveAccount).toHaveBeenCalledWith(0, NetworkType.Ethereum);
    expect(adapter.listAccounts).toHaveBeenNthCalledWith(2, NetworkType.Ethereum);

    expect(result.deviceId).toBe('ble-001');
    expect(result.accounts).toEqual([firstAccount]);
  });

  it('starts BSIM BLE scan with CT prefix and forwards callbacks', async () => {
    const mockedStart = startBleDeviceScan as unknown as jest.Mock;

    const stop = jest.fn();
    mockedStart.mockImplementation((_options: unknown, onDevice: (d: any) => void) => {
      onDevice({ deviceId: 'ble-001', name: 'CT-TEST' });
      return { stop };
    });

    const onDevice = jest.fn();
    const handle = service.startBSIMBleScan(onDevice);

    expect(mockedStart).toHaveBeenCalledWith({ namePrefix: 'CT', serviceUuids: undefined }, expect.any(Function), undefined);
    expect(onDevice).toHaveBeenCalledWith({ deviceId: 'ble-001', name: 'CT-TEST' });

    handle.stop();
    expect(stop).toHaveBeenCalled();
  });
  it('rejects on recovery mode error code 6A88 and does not derive accounts', async () => {
    const adapter = createAdapter({ id: 'adapter' });
    const err = Object.assign(new Error('Wrong BPIN, unable to complete authentication. Error code: 6A88'), { code: '6A88' });
    adapter.listAccounts.mockRejectedValueOnce(err);

    registry.register(HARDWARE_WALLET_TYPES.BSIM, undefined, adapter);

    await expect(service.connectAndSync(HARDWARE_WALLET_TYPES.BSIM)).rejects.toMatchObject({ code: '6A88' });
    expect(adapter.deriveAccount).not.toHaveBeenCalled();
  });

  it('prefers adapter registered with matching deviceIdentifier', async () => {
    const fallback = createAdapter({ id: 'fallback' });
    const preferred = createAdapter({ id: 'preferred' });

    preferred.listAccounts.mockResolvedValueOnce([
      {
        index: 0,
        address: '0xdeadbeef',
        chainType: NetworkType.Ethereum,
        derivationPath: "m/44'/60'/0'/0/0",
      },
    ]);

    registry.register(HARDWARE_WALLET_TYPES.BSIM, undefined, fallback);
    registry.register(HARDWARE_WALLET_TYPES.BSIM, 'ble-777', preferred);

    await service.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier: 'ble-777' });

    expect(preferred.connect).toHaveBeenCalled();
    expect(fallback.connect).not.toHaveBeenCalled();
  });

  it('throws when no adapter is registered', async () => {
    await expect(service.connectAndSync(HARDWARE_WALLET_TYPES.BSIM)).rejects.toThrow('No adapter is registered for type');
  });

  it('runs update pin via BSIM adapter and connects using vault hardwareDeviceId', async () => {
    const adapter = createBSIMWalletAdapter({ id: 'bsim' });
    registry.register(HARDWARE_WALLET_TYPES.BSIM, 'ble-001', adapter);

    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const vault = await db.write(async () =>
      db.get<Vault>(TableName.Vault).create((record) => {
        record.type = VaultType.BSIM;
        record.device = 'ePayWallet';
        record.hardwareDeviceId = 'ble-001';
        record.data = 'BSIM Wallet';
        record.cfxOnly = false;
        record.isBackup = false;
        record.source = 'create_by_wallet' as any;
      }),
    );

    await expect(service.runUpdatePin(vault.id)).resolves.toBe('ok');
    await service.connectAndSync(HARDWARE_WALLET_TYPES.BSIM, { deviceIdentifier: 'ble-001' });
    const expectedConnectArgs = {
      transport: Platform.OS === 'ios' ? 'ble' : 'apdu',
      deviceIdentifier: 'ble-001',
      signal: undefined,
    };

    expect(adapter.connect).toHaveBeenNthCalledWith(1, expectedConnectArgs);
    expect(adapter.connect).toHaveBeenNthCalledWith(2, expectedConnectArgs);
  });

  it('throws when vault has no hardwareDeviceId for BSIM operations', async () => {
    const adapter = createBSIMWalletAdapter({ id: 'bsim' });
    registry.register(HARDWARE_WALLET_TYPES.BSIM, 'ble-001', adapter);

    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const vault = await db.write(async () =>
      db.get<Vault>(TableName.Vault).create((record) => {
        record.type = VaultType.BSIM;
        record.device = 'ePayWallet';
        record.hardwareDeviceId = null;
        record.data = 'BSIM Wallet';
        record.cfxOnly = false;
        record.isBackup = false;
        record.source = 'create_by_wallet' as any;
      }),
    );

    await expect(service.runUpdatePin(vault.id)).rejects.toThrow('Missing hardwareDeviceId');
    expect(adapter.connect).not.toHaveBeenCalled();
  });

  it('runs backup and restore seed via BSIM adapter', async () => {
    const adapter = createBSIMWalletAdapter({ id: 'bsim' });
    registry.register(HARDWARE_WALLET_TYPES.BSIM, 'ble-002', adapter);

    const db = container.get<Database>(CORE_IDENTIFIERS.DB);
    const vault = await db.write(async () =>
      db.get<Vault>(TableName.Vault).create((record) => {
        record.type = VaultType.BSIM;
        record.device = 'ePayWallet';
        record.hardwareDeviceId = 'ble-002';
        record.data = 'BSIM Wallet';
        record.cfxOnly = false;
        record.isBackup = false;
        record.source = 'create_by_wallet' as any;
      }),
    );

    const backupParams: BackupSeedParams = { key2: 'k2' };
    const restoreParams: RestoreSeedParams = { key2: 'k2', cipherHex: '0xabc' };

    await expect(service.runBackupSeed(vault.id, backupParams)).resolves.toBe('0xbackup');
    await expect(service.runRestoreSeed(vault.id, restoreParams)).resolves.toBe('ok');

    const expectedConnectArgs = {
      transport: Platform.OS === 'ios' ? 'ble' : 'apdu',
      deviceIdentifier: 'ble-002',
      signal: undefined,
    };

    expect(adapter.connect).toHaveBeenNthCalledWith(1, expectedConnectArgs);
    expect(adapter.connect).toHaveBeenNthCalledWith(2, expectedConnectArgs);
  });
});
