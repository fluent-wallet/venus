import type { ExternalInputHandlerStackName, StackScreenProps } from '@router/configs';
import { useAssetsOfCurrentAddress } from '@service/asset';
import { useCurrentNetwork } from '@service/network';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { handleExternalInput } from './parser';
import QrScannerContent from './QrScannerContent';

const ExternalInputHandler: React.FC<StackScreenProps<typeof ExternalInputHandlerStackName>> = ({ navigation, route }) => {
  const { data: currentNetwork } = useCurrentNetwork();
  const { data: assets = [] } = useAssetsOfCurrentAddress();
  const { t } = useTranslation();

  return (
    <QrScannerContent
      title={t('scan.title')}
      externalData={route.params?.data}
      onClose={() => {
        if (navigation.canGoBack()) navigation.goBack();
      }}
      parseInput={(raw, helpers) =>
        handleExternalInput(raw, {
          currentNetwork,
          assets,
          navigation,
          t,
          setStatus: helpers.setStatus,
        })
      }
    />
  );
};

export default ExternalInputHandler;
