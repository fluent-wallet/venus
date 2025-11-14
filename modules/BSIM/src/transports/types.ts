import type { ApduTransmit } from '../core/types';

export type TransportKind = 'apdu' | 'ble';

export type TransportSession = {
  transmit: ApduTransmit;
  close: () => Promise<void>;
};

export interface Transport<TOptions = void> {
  readonly kind: TransportKind;
  open(options?: TOptions): Promise<TransportSession>;
}
