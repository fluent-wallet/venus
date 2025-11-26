import type React from 'react';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import type { PaymentUriPayload } from '@utils/payment-uri';
import QrScannerSheet from './QrScannerSheet';
import { paymentUriParser } from './parser';
import { ExternalInputHandlerStackName, type StackScreenProps, type StackNavigation } from '@router/configs';
import { getActiveRouteName } from '@utils/backToHome';

// keep deep link listener
export const useListenDeepLink = (navigation: StackNavigation) => {
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const url = decodeURIComponent(event.url);

        let data: string | null = null;
        if (url.startsWith('bimwallet://')) {
          if (url.startsWith('bimwallet://wc?uri=')) {
            data = url.slice(19);
          } else if (url.startsWith('bimwallet://wc?')) {
            data = url.slice(12);
          }
        } else {
          data = url;
        }
        const hasCurrentWCEvent = plugins.WalletConnect.currentEventSubject.getValue();
        if (!data || hasCurrentWCEvent) return;
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

    Linking.getInitialURL().then((url) => url && handleDeepLink({ url }));
    const urlListener = Linking.addEventListener('url', handleDeepLink);

    return () => {
      urlListener.remove();
    };
  }, [navigation]);
};

interface Props extends Partial<StackScreenProps<typeof ExternalInputHandlerStackName>> {
  mode?: 'inline' | 'route';
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  onClose?: () => void;
}

const ExternalInputHandler: React.FC<Props> = ({ navigation, onConfirm, onClose, route, ...props }) => {
  const currentNetwork = useCurrentNetwork()!;
  const { t } = useTranslation();
  const externalData = route?.params?.data;
  const mode: 'inline' | 'route' = props.mode ?? (onConfirm ? 'inline' : 'route');

  return (
    <QrScannerSheet
      mode={mode}
      title={t('scan.title')}
      externalData={externalData}
      onConfirm={(paymentUri: PaymentUriPayload) => {
        if (onConfirm) {
          onConfirm(paymentUri);
        }
      }}
      onClose={onClose}
      onDismiss={() => {
        if (navigation?.canGoBack()) {
          navigation.goBack();
        }
      }}
      parseInput={(raw, helpers) =>
        paymentUriParser(raw, {
          currentNetwork,
          navigation,
          onConfirm,
          t,
          setStatus: helpers.setStatus,
        })
      }
    />
  );
};

export default ExternalInputHandler;
