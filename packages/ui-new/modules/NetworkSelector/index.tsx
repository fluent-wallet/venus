import Sheet, { SheetHeader, SheetHeaderAction } from '@components/Sheet';
import NetworksList from '@modules/NetworksList';
import { useTheme } from '@react-navigation/native';
import { useSwitchNetwork } from '@service/network';
import { useSelectableNetworks } from '@service/selectableNetworks';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onClose: () => void;
  isOpen?: boolean;
}

const NetworkSelector: React.FC<Props> = ({ onClose, isOpen }) => {
  const { colors } = useTheme();

  return (
    <Sheet isPresented={!!isOpen} height={{ fraction: 0.8 }} containerColor={colors.bgFourth} onDismiss={onClose}>
      <NetworkSelectorContent onClose={onClose} />
    </Sheet>
  );
};

function NetworkSelectorContent({ onClose }: Pick<Props, 'onClose'>) {
  const { t } = useTranslation();
  const switchNetwork = useSwitchNetwork();
  const { networks, currentNetworkId } = useSelectableNetworks();
  const handleSelectNetwork = useCallback(
    (networkId: string) => {
      switchNetwork(networkId).catch(() => undefined);
      onClose();
    },
    [switchNetwork, onClose],
  );

  return (
    <>
      <SheetHeader title={t('common.network')} action={<SheetHeaderAction testID="edit">{t('common.edit')}</SheetHeaderAction>} />
      <NetworksList networks={networks} currentNetworkId={currentNetworkId} onSelectNetwork={handleSelectNetwork} />
    </>
  );
}

export default NetworkSelector;
