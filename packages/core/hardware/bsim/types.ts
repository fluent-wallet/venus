import type { Wallet, WalletOptions } from 'react-native-bsim';

/**
 * Reasons why hardware wallet might be unavailable
 */
export type HardwareUnavailableReason = 'card_missing' | 'ble_device_not_found' | 'bluetooth_disabled' | 'permission_denied';

/**
 * Factory function type for creating BSIM Wallet instances
 * Used for dependency injection in tests
 */
export type WalletFactory = (options: WalletOptions) => Wallet;

/**
 * Options for retry mechanism with timeout
 */
export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Configuration options for BSIMHardwareWallet adapter
 */
export type BSIMAdapterOptions = {
  id?: string;
  walletFactory?: WalletFactory;
  walletOptions?: Pick<WalletOptions, 'idleTimeoutMs' | 'logger'>;
};
