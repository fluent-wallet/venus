import type { EventBusServer } from './Events/eventServer';

export const SERVICE_IDENTIFIER = {
  /**
   * EventBus
   */
  EVENT_BUS: 'EVENT_BUS',
} as const;

export interface ServiceMap {
  [SERVICE_IDENTIFIER.EVENT_BUS]: EventBusServer;
}

export type ServiceKey = keyof typeof SERVICE_IDENTIFIER;

export type ServiceType<K extends ServiceKey = ServiceKey, T extends ServiceMap = ServiceMap> = T[K];
