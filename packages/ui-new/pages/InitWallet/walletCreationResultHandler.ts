import { CommonActions } from '@react-navigation/native';
import { HomeStackName, type StackNavigation } from '@router/configs';
import { getWalletCreationDuplicateMessage, getWalletCreationUnknownMessage, type WalletCreationResult } from '@service/walletCreation';
import { showMessage } from 'react-native-flash-message';

type HandleWalletCreationResultOptions = {
  navigation: StackNavigation;
  result: WalletCreationResult;
  successMessage?: string;
};

function navigateToHome(navigation: StackNavigation): void {
  navigation.navigate(HomeStackName);
  navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
}

/**
 * Apply shared page feedback for one wallet creation result.
 * Returns true when the flow is complete and navigation already happened.
 */
export function handleWalletCreationResult({ navigation, result, successMessage }: HandleWalletCreationResultOptions): boolean {
  if (result.status === 'success') {
    if (successMessage) {
      showMessage({ type: 'success', message: successMessage });
    }

    navigateToHome(navigation);
    return true;
  }

  if (result.status === 'duplicate') {
    showMessage({
      type: 'failed',
      message: getWalletCreationDuplicateMessage(result.displayType),
    });
    return false;
  }

  if (result.status === 'error') {
    showMessage({
      type: 'failed',
      message: getWalletCreationUnknownMessage(result.displayType),
      description: String(result.error ?? ''),
    });
  }

  return false;
}
