import { StackActions } from '@react-navigation/native';
import { ExternalInputHandlerStackName, type StackNavigation, type StackScreenProps, WalletConnectStackName } from '@router/configs';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { useCurrentNetwork } from '@service/network';
import { getActiveRouteName } from '@utils/backToHome';
import type { PaymentUriPayload } from '@utils/payment-uri';
import type React from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { paymentUriParser } from './parser';
import QrScannerSheet from './QrScannerSheet';

// keep deep link listener
export const useListenDeepLink = (navigation: StackNavigation) => {
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const rawUrl = event.url;

        let data: string | null = null;
        if (rawUrl.startsWith('bimwallet://')) {
          try {
            const parsed = new URL(rawUrl);
            if (parsed.host === 'wc') {
              const uri = parsed.searchParams.get('uri');
              if (uri) data = uri;
              else if (parsed.search) data = parsed.search.slice(1);
            }
          } catch {
            // fallback to legacy slicing below
          }

          if (!data) {
            if (rawUrl.startsWith('bimwallet://wc?uri=')) {
              data = rawUrl.slice(19);
            } else if (rawUrl.startsWith('bimwallet://wc?')) {
              data = rawUrl.slice(12);
            }
          }
        } else {
          // Non-bimwallet URLs are safe to decode as a whole (payment URI / raw protocols).
          try {
            data = decodeURIComponent(rawUrl);
          } catch {
            data = rawUrl;
          }
        }
        if (!data) return;

        const activeRouterName = getActiveRouteName(navigation.getState());
        if (activeRouterName === WalletConnectStackName) return;
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

interface Props extends Partial<StackScreenProps<typeof ExternalInputHandlerStackName>> {
  mode?: 'inline' | 'route';
  onConfirm?: (paymentUri: PaymentUriPayload) => void;
  onClose?: () => void;
}

const ExternalInputHandler: React.FC<Props> = ({ navigation, onConfirm, onClose, route, ...props }) => {
  const { data: currentNetwork } = useCurrentNetwork();
  const assetsQuery = useAssetsOfCurrentAddress();
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
          assets: assetsQuery.data ?? [],
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
