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

const normalizeExternalInput = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('bimwallet://')) {
    return trimmed;
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
};

// keep deep link listener
export const useListenDeepLink = (navigation: StackNavigation) => {
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const data = normalizeExternalInput(event.url);
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
