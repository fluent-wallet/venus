import type { ICryptoTool } from './Plugins/CryptoTool/interface';
import type { INFTDetailTrackerServerInterface } from './Plugins/NFTDetailTracker/server';
import type { IAssetsTrackerServerInterface } from './Plugins/AssetsTracker/server';
import type { INextNonceTrackerServerInterface } from './Plugins/NextNonceTracker/server';
import type { EventBus } from './Events';
import type { Database } from '@core/database';

export const SERVICE_IDENTIFIER = {
  CORE: 'CORE',

  /**
   * EventBus
   */
  EVENT_BUS: 'EVENT_BUS',

  /**
   * Database
   * ---------------------------------------------------------
   */

  DB: 'DB',

  // DB end // ---------------------------------------------------------

  /**
   * CryptoTool
   */
  CRYPTO_TOOL: 'CRYPTO_TOOL',

  /**
   * TxTrackerPlugin
   */
  TX_TRACKER: 'TX_TRACKER',

  /**
   * NFTDetailTracker
   */
  NFT_DETAIL_TRACKER: 'NFT_DETAIL_TRACKER',

  /**
   * ReceiveAssetsTracker
   */
  RECEIVE_ASSETS_TRACKER: 'RECEIVE_ASSETS_TRACKER',

  /**
   * AssetsTracker
   */
  ASSETS_TRACKER: 'ASSETS_TRACKER',

  /**
   * NextNonceTracker
   */
  NEXT_NONCE_TRACKER: 'NEXT_NONCE_TRACKER',

  /**
   * WalletConfigPlugin
   */
  WALLET_CONFIG: 'WALLET_CONFIG',

  /**
   * TxMethod
   */
  TX_METHOD: 'TX_METHOD',
} as const;

export interface ServiceMap {
  [SERVICE_IDENTIFIER.EVENT_BUS]: EventBus;
  [SERVICE_IDENTIFIER.CORE]: ICryptoTool;
  [SERVICE_IDENTIFIER.DB]: Database;

  [SERVICE_IDENTIFIER.NFT_DETAIL_TRACKER]: INFTDetailTrackerServerInterface;
  [SERVICE_IDENTIFIER.ASSETS_TRACKER]: IAssetsTrackerServerInterface;
  [SERVICE_IDENTIFIER.NEXT_NONCE_TRACKER]: INextNonceTrackerServerInterface;
}
