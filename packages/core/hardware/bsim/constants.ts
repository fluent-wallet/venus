import { CARD_ERROR_MESSAGES, COIN_TYPE_CONFIG, CoinTypes } from 'react-native-bsim';

/**
 * EVM coin type constant for BIP-44 derivation path (coin type 60)
 */
export const EVM_COIN_TYPE = COIN_TYPE_CONFIG[CoinTypes.ETHEREUM].index;

/**
 * Default BIP-44 derivation path prefix for Ethereum accounts
 * Format: m/44'/60'/0'/0
 */
export const DEFAULT_DERIVATION_PREFIX = `m/44'/${COIN_TYPE_CONFIG[CoinTypes.ETHEREUM].index}'/0'/0`;

/**
 * Regex pattern to validate hexadecimal strings
 */
export const HEX_PATTERN = /^[0-9A-F]*$/i;

/**
 * Regex pattern to extract card status codes from error messages
 * Matches formats like "status=6985", "code: 0x6985", etc.
 */
export const CARD_STATUS_MATCHER = /\b(?:status|code)\s*(?:=|:)?\s*(0x)?([0-9A-F]{4})\b/i;

/**
 * Error code for hardware unavailability (BLE disconnected, card removed, etc.)
 */
export const BSIM_HARDWARE_UNAVAILABLE = 'HARDWARE_UNAVAILABLE' as const;

/**
 * Error code for user cancellation of BSIM operations
 */
export const BSIM_ERROR_CANCEL = 'CANCEL' as const;

export const BSIM_ERRORS: Record<string, string> = {
  ...CARD_ERROR_MESSAGES,
  A000: 'BSIM error, unknown error.',
  [BSIM_HARDWARE_UNAVAILABLE]: 'Hardware not available',
  [BSIM_ERROR_CANCEL]: 'User cancelled the BSIM operation.',
  DEFAULT: 'BSIM error, unknown error.',
};

/**
 * Error message for unsupported chain types
 */
export const EVM_CHAIN_ERROR = 'BSIM adapter only supports Ethereum-compatible chains at the moment.';

/**
 * Maximum number of accounts allowed for BSIM hardware wallets
 */
export const BSIM_ACCOUNT_LIMIT = 127;

export const HARDWARE_WALLET_TYPES = {
  BSIM: 'BSIM' as const,
};
