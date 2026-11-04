import i18n from '@assets/i18n';
import { StackActions } from '@react-navigation/native';
import { ExternalInputHandlerStackName, type StackNavigation } from '@router/configs';
import { getExternalRequestsService } from '@service/core';
import { handleWalletConnectLink, parseWalletConnectLink } from '@service/walletConnectLink';
import { getActiveRouteName } from '@utils/backToHome';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { showMessage } from 'react-native-flash-message';

const getDeepLinkInput = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Expo owns this scheme; launch URLs vary between development client versions.
  if (/^exp\+venus-wallet:/i.test(trimmed)) return null;

  if (trimmed.startsWith('bimwallet://')) {
    return trimmed;
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

export const useListenDeepLink = (navigation: StackNavigation) => {
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const data = getDeepLinkInput(event.url);
        if (!data) return;

        const walletConnectLink = parseWalletConnectLink(data);
        if (walletConnectLink && (walletConnectLink.type === 'wakeup' || getExternalRequestsService().hasActiveRequests({ provider: 'wallet-connect' }))) {
          // The existing request queue decides when to show a confirmation screen.
          void handleWalletConnectLink(walletConnectLink).catch((error) => {
            console.log('handleWalletConnectLink error', error);
            showMessage({ type: 'danger', message: `${i18n.t('scan.walletConnect.error.connectFailed')} ${String(error ?? '')}` });
          });
          return;
        }

        const activeRouterName = getActiveRouteName(navigation.getState());
        if (activeRouterName === ExternalInputHandlerStackName) {
          navigation.dispatch(StackActions.replace(ExternalInputHandlerStackName, { data }));
        } else {
          navigation.navigate(ExternalInputHandlerStackName, { data });
        }
      } catch (error) {
        console.log('handleDeepLinking error', error);
      }
    };

    Linking.getInitialURL()
      .then((url) => url && handleDeepLink({ url }))
      .catch((error) => console.log(error));
    const urlListener = Linking.addEventListener('url', handleDeepLink);

    return () => {
      urlListener.remove();
    };
  }, [navigation]);
};
