import type { EventBus } from './Events/eventTypes';
import type { ICryptoTool } from './Plugins/CryptoTool/interface';

export const SERVICE_IDENTIFIER = {
  CORE: 'CORE',

  /**
   * EventBus
   */
  EVENT_BUS: 'EVENT_BUS',

  /**
   * CryptoTool
   */
  CRYPTO_TOOL: 'CRYPTO_TOOL',


  /**
   * TxTrackerPlugin
   */
  TX_TRACKER: 'TX_TRACKER',
} as const;

export interface ServiceMap {
  [SERVICE_IDENTIFIER.EVENT_BUS]: EventBus;
  [SERVICE_IDENTIFIER.CORE]: ICryptoTool;
}
