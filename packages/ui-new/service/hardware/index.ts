import type { HardwareConnectOptions, HardwareOperationError } from '@core/types';
import {
  HARDWARE_SIGN_ABORT_EVENT,
  HARDWARE_SIGN_ERROR_EVENT,
  HARDWARE_SIGN_START_EVENT,
  HARDWARE_SIGN_SUCCESS_EVENT,
} from '@core/WalletCore/Events/eventTypes';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BackupSeedParams, RestoreSeedParams } from 'modules/BSIM/src';
import { useEffect } from 'react';
import { getEventBus, getHardwareWalletService } from '../core';

export type HardwareSignPhase = 'idle' | 'start' | 'success' | 'error' | 'abort';

export type HardwareSignState = {
  requestId: string;
  phase: HardwareSignPhase;
  accountId: string;
  addressId: string;
  networkId: string;
  txHash?: string;
  rawTransaction?: string;
  error?: HardwareOperationError;
  txPayload?: unknown;
  updatedAt: number;
};

export const getHardwareSignStateKey = () => ['hardware', 'signState'] as const;

function nowMs() {
  return Date.now();
}

function matchesCurrentRequest(prev: HardwareSignState | null | undefined, requestId: string): boolean {
  return !!prev && prev.requestId === requestId;
}

export function useHardwareSigningEvents(addressId?: string) {
  const queryClient = useQueryClient();
  const eventBus = getEventBus();

  useEffect(() => {
    const handleStart = (payload: any) => {
      if (addressId && payload.addressId !== addressId) return;

      const next: HardwareSignState = {
        requestId: payload.requestId,
        phase: 'start',
        accountId: payload.accountId,
        addressId: payload.addressId,
        networkId: payload.networkId,
        txPayload: payload.txPayload,
        updatedAt: nowMs(),
      };

      queryClient.setQueryData(getHardwareSignStateKey(), next);
    };

    const handleSuccess = (payload: any) => {
      if (addressId && payload.addressId !== addressId) return;

      queryClient.setQueryData(getHardwareSignStateKey(), (prev: HardwareSignState | null | undefined) => {
        if (!matchesCurrentRequest(prev, payload.requestId)) return prev ?? null;

        return {
          requestId: payload.requestId,
          phase: 'success',
          accountId: payload.accountId,
          addressId: payload.addressId,
          networkId: payload.networkId,
          txHash: payload.txHash,
          rawTransaction: payload.rawTransaction,
          updatedAt: nowMs(),
        };
      });
    };

    const handleError = (payload: any) => {
      if (addressId && payload.addressId !== addressId) return;

      queryClient.setQueryData(getHardwareSignStateKey(), (prev: HardwareSignState | null | undefined) => {
        if (!matchesCurrentRequest(prev, payload.requestId)) return prev ?? null;

        return {
          requestId: payload.requestId,
          phase: 'error',
          accountId: payload.accountId,
          addressId: payload.addressId,
          networkId: payload.networkId,
          error: payload.error,
          updatedAt: nowMs(),
        };
      });
    };

    const handleAbort = (payload: any) => {
      if (addressId && payload.addressId !== addressId) return;

      queryClient.setQueryData(getHardwareSignStateKey(), (prev: HardwareSignState | null | undefined) => {
        if (!matchesCurrentRequest(prev, payload.requestId)) return prev ?? null;

        return {
          requestId: payload.requestId,
          phase: 'abort',
          accountId: payload.accountId,
          addressId: payload.addressId,
          networkId: payload.networkId,
          updatedAt: nowMs(),
        };
      });
    };
    const subs = [
      eventBus.on(HARDWARE_SIGN_START_EVENT).subscribe(handleStart),
      eventBus.on(HARDWARE_SIGN_SUCCESS_EVENT).subscribe(handleSuccess),
      eventBus.on(HARDWARE_SIGN_ERROR_EVENT).subscribe(handleError),
      eventBus.on(HARDWARE_SIGN_ABORT_EVENT).subscribe(handleAbort),
    ];

    return () =>
      subs.forEach((sub) => {
        sub.unsubscribe();
      });
  }, [addressId, eventBus, queryClient]);
}

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
