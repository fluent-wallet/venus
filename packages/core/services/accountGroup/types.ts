import type { VaultSourceType, VaultType } from '@core/types/vault';

export interface IAccountGroup {
  id: string;
  nickname: string;
  vaultId: string;
  vaultType: VaultType;
  vaultSource: VaultSourceType;
  isBackup: boolean;
  isGroup: boolean;
  hardwareDeviceId: string | null;
  accountCount: number;
  visibleAccountCount: number;
  lastAccountIndex: number;
}
