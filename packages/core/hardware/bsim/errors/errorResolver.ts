import { Platform } from 'react-native';
import { CARD_ERROR_MESSAGES, type CardErrorCode, isCardErrorCode, TransportError, TransportErrorCode } from 'react-native-bsim';
import { BSIM_ERROR_CANCEL, BSIM_ERRORS, BSIM_HARDWARE_UNAVAILABLE, CARD_STATUS_MATCHER } from '../constants';
import type { HardwareUnavailableReason } from '../types';
import { BSIMHardwareError } from './BSIMHardwareError';

/**
 * Extracts card status code from TransportError
 * Checks both native error code and error message
 */
export const resolveCardStatus = (error: TransportError): { code: CardErrorCode; message: string } | undefined => {
  const native = error.details?.nativeCode?.toUpperCase();
  if (native && isCardErrorCode(native)) {
    return { code: native, message: CARD_ERROR_MESSAGES[native] };
  }
  const match = error.message?.match(CARD_STATUS_MATCHER);
  const candidate = match?.[2]?.toUpperCase();
  if (candidate && isCardErrorCode(candidate)) {
    return { code: candidate, message: CARD_ERROR_MESSAGES[candidate] };
  }
  return undefined;
};

/**
 * Determines specific reason for hardware unavailability
 * Platform-specific logic for Android APDU and iOS BLE errors
 */
export const resolveHardwareUnavailableReason = (error: TransportError): HardwareUnavailableReason | undefined => {
  if (Platform.OS === 'android') {
    const androidCode = error.code as TransportErrorCode | undefined;
    if (
      androidCode === TransportErrorCode.CHANNEL_OPEN_FAILED ||
      androidCode === TransportErrorCode.CHANNEL_NOT_OPEN ||
      androidCode === TransportErrorCode.DEVICE_NOT_FOUND
    ) {
      return 'card_missing';
    }
  }
  if (Platform.OS === 'ios') {
    if (error.code === TransportErrorCode.SCAN_FAILED) {
      const lower = (error.message ?? '').toLowerCase();
      if (lower.includes('permission')) return 'permission_denied';
      if (lower.includes('bluetooth') || lower.includes('power on')) return 'bluetooth_disabled';
      return 'ble_device_not_found';
    }
    if (
      error.code === TransportErrorCode.CHARACTERISTIC_NOT_FOUND ||
      error.code === TransportErrorCode.READ_TIMEOUT ||
      error.code === TransportErrorCode.CHANNEL_NOT_OPEN
    ) {
      return 'ble_device_not_found';
    }
  }
  return undefined;
};

/**
 * Normalizes all error types to BSIMHardwareError with unified structure
 */
export const normalizeError = (error: unknown): BSIMHardwareError => {
  if (error instanceof BSIMHardwareError) return error;
  const explicitCode = typeof (error as { code?: unknown })?.code === 'string' ? ((error as { code: string }).code ?? '').toUpperCase() : undefined;

  if (explicitCode === BSIM_ERROR_CANCEL) {
    return new BSIMHardwareError(BSIM_ERROR_CANCEL, BSIM_ERRORS[BSIM_ERROR_CANCEL]);
  }

  if (error instanceof TransportError) {
    const status = resolveCardStatus(error);
    if (status) {
      return new BSIMHardwareError(status.code, BSIM_ERRORS[status.code] ?? status.message);
    }
    const reason = resolveHardwareUnavailableReason(error);
    if (reason) {
      return new BSIMHardwareError(BSIM_HARDWARE_UNAVAILABLE, BSIM_ERRORS[BSIM_HARDWARE_UNAVAILABLE], { reason });
    }
    const fallbackCode = error.code ?? TransportErrorCode.TRANSMIT_FAILED;
    const fallbackMessage = BSIM_ERRORS[fallbackCode] ?? error.message ?? BSIM_ERRORS.DEFAULT;
    return new BSIMHardwareError(fallbackCode, fallbackMessage, { details: error.details });
  }
  const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code.toUpperCase() : undefined;
  if (code) {
    const message = BSIM_ERRORS[code] ?? (error as Error).message ?? BSIM_ERRORS.DEFAULT;
    return new BSIMHardwareError(code, message);
  }
  if (error instanceof Error) {
    return new BSIMHardwareError('UNKNOWN', error.message);
  }
  return new BSIMHardwareError('UNKNOWN', BSIM_ERRORS.DEFAULT);
};
