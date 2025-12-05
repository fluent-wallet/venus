import { BSIM_HARDWARE_UNAVAILABLE, type BSIMHardwareReason, type BSIMHardwareUnavailableError } from '@WalletCoreExtends/Plugins/BSIM';
import type { StackNavigation } from '@router/configs';
import { BSIMAvailabilityStackName } from '@router/configs';

type NavigationLike = Pick<StackNavigation, 'navigate'>;

interface HandleBSIMHardwareUnavailableOptions {
  beforeNavigate?: () => void;
}

const isBSIMHardwareUnavailable = (error: unknown): error is BSIMHardwareUnavailableError => {
  return (error as BSIMHardwareUnavailableError)?.code === BSIM_HARDWARE_UNAVAILABLE;
};

export const handleBSIMHardwareUnavailable = (
  error: unknown,
  navigation: NavigationLike,
  options?: HandleBSIMHardwareUnavailableOptions,
): error is BSIMHardwareUnavailableError => {
  if (!isBSIMHardwareUnavailable(error)) {
    return false;
  }

  options?.beforeNavigate?.();

  navigation.navigate(BSIMAvailabilityStackName, {
    reason: error.reason,
  });

  return true;
};

export const getBSIMHardwareReason = (error: unknown): BSIMHardwareReason | undefined => {
  if (!isBSIMHardwareUnavailable(error)) {
    return undefined;
  }
  return error.reason;
};
