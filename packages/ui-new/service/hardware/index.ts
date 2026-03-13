import type { HardwareConnectOptions } from '@core/types';
import { useMutation } from '@tanstack/react-query';
import type { BackupSeedParams, RestoreSeedParams } from 'modules/BSIM/src';
import { getHardwareWalletService } from '../core';

export function useConnectHardware() {
  const service = getHardwareWalletService();
  return useMutation({
    mutationFn: async (input: { type: string; options?: HardwareConnectOptions }) => {
      return service.connectAndSync(input.type, input.options);
    },
  });
}

export function useBsimUpdatePin() {
  const service = getHardwareWalletService();
  return useMutation({
    mutationFn: async (input: { vaultId: string; signal?: AbortSignal }) => {
      return service.runUpdatePin(input.vaultId, input.signal ? { signal: input.signal } : undefined);
    },
  });
}

export function useBsimBackup() {
  const service = getHardwareWalletService();
  return useMutation({
    mutationFn: async (input: { vaultId: string; params: BackupSeedParams; signal?: AbortSignal }) => {
      return service.runBackupSeed(input.vaultId, input.params, input.signal ? { signal: input.signal } : undefined);
    },
  });
}

export function useBsimRestore() {
  const service = getHardwareWalletService();
  return useMutation({
    mutationFn: async (input: { vaultId: string; params: RestoreSeedParams; signal?: AbortSignal }) => {
      return service.runRestoreSeed(input.vaultId, input.params, input.signal ? { signal: input.signal } : undefined);
    },
  });
}
