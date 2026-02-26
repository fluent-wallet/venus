import type { CoreEventMap } from '@core/modules/eventBus';
import type { HardwareOperationError } from '@core/types';
import { getEventBus } from '@service/core';
import { useCallback, useEffect, useRef, useState } from 'react';

export type HardwareSigningUiState = { phase: 'start' } | { phase: 'error'; error?: HardwareOperationError } | null;

type StartedPayload = CoreEventMap['hardware-sign/started'];
type SucceededPayload = CoreEventMap['hardware-sign/succeeded'];
type FailedPayload = CoreEventMap['hardware-sign/failed'];
type AbortedPayload = CoreEventMap['hardware-sign/aborted'];

export function useHardwareSigningUiState(addressId?: string): { state: HardwareSigningUiState; clear: () => void } {
  const [state, setState] = useState<HardwareSigningUiState>(null);
  const requestIdRef = useRef<string | null>(null);
  const eventBus = getEventBus();

  const clear = useCallback(() => {
    requestIdRef.current = null;
    setState(null);
  }, []);

  useEffect(() => {
    clear();
  }, [addressId, clear]);

  useEffect(() => {
    const accept = (payload: { requestId: string }) => requestIdRef.current === payload.requestId;
    const filterAddress = (payload: { addressId: string }) => !addressId || payload.addressId === addressId;

    const onStarted = (payload: StartedPayload) => {
      if (!filterAddress(payload)) return;
      requestIdRef.current = payload.requestId;
      setState({ phase: 'start' });
    };

    const onFailed = (payload: FailedPayload) => {
      if (!filterAddress(payload)) return;
      if (!accept(payload)) return;
      setState({ phase: 'error', error: payload.error });
    };

    const onAborted = (payload: AbortedPayload) => {
      if (!filterAddress(payload)) return;
      if (!accept(payload)) return;
      clear();
    };

    const onSucceeded = (payload: SucceededPayload) => {
      if (!filterAddress(payload)) return;
      if (!accept(payload)) return;
      clear();
    };

    const subs = [
      eventBus.on('hardware-sign/started', onStarted),
      eventBus.on('hardware-sign/failed', onFailed),
      eventBus.on('hardware-sign/aborted', onAborted),
      eventBus.on('hardware-sign/succeeded', onSucceeded),
    ];

    return () =>
      subs.forEach((sub) => {
        sub.unsubscribe();
      });
  }, [addressId, clear, eventBus]);

  return { state, clear };
}
