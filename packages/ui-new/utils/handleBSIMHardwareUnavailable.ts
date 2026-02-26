import { BSIM_HARDWARE_UNAVAILABLE } from '@core/hardware/bsim/constants';
import type { HardwareUnavailableReason } from '@core/hardware/bsim/types';
import type { StackNavigation } from '@router/configs';
import { BSIMAvailabilityStackName } from '@router/configs';

type NavigationLike = Pick<StackNavigation, 'navigate'>;

export type BSIMHardwareReason = HardwareUnavailableReason;

interface HandleBSIMHardwareUnavailableOptions {
  beforeNavigate?: () => void;
}

type ErrorLike = {
  code?: unknown;
  reason?: unknown;
  details?: { reason?: unknown };
};

const asErrorLike = (error: unknown): ErrorLike | null => {
  if (!error || typeof error !== 'object') return null;
  return error as ErrorLike;
};

const getReason = (error: ErrorLike): unknown => error.reason ?? error.details?.reason;

type BSIMHardwareUnavailableLikeError = {
  code: typeof BSIM_HARDWARE_UNAVAILABLE;
  reason?: BSIMHardwareReason;
  details?: { reason?: BSIMHardwareReason };
};

const isBSIMHardwareUnavailable = (error: unknown): error is BSIMHardwareUnavailableLikeError => {
  const candidate = asErrorLike(error);
  if (!candidate) return false;
  if (candidate.code !== BSIM_HARDWARE_UNAVAILABLE) return false;
  return typeof getReason(candidate) === 'string';
};

export const handleBSIMHardwareUnavailable = (
  error: unknown,
  navigation: NavigationLike,
  options?: HandleBSIMHardwareUnavailableOptions,
): error is BSIMHardwareUnavailableLikeError => {
  if (!isBSIMHardwareUnavailable(error)) {
    return false;
  }

  options?.beforeNavigate?.();

  const reason = getReason(asErrorLike(error)!) as BSIMHardwareReason;

  navigation.navigate(BSIMAvailabilityStackName, {
    reason,
  });

  return true;
};

export const getBSIMHardwareReason = (error: unknown): BSIMHardwareReason | undefined => {
  if (!isBSIMHardwareUnavailable(error)) {
    return undefined;
  }
  return getReason(asErrorLike(error)!) as BSIMHardwareReason;
};
