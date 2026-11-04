import Sheet from '@components/Sheet';
import { useTheme } from '@react-navigation/native';
import { useCurrentNetwork } from '@service/network';
import { useTranslation } from 'react-i18next';
import { parseRecipientInput } from './paymentInput';
import QrScannerContent from './QrScannerContent';

type Props = {
  isOpen: boolean;
  onConfirm: (address: string) => void;
  onClose: () => void;
};

export default function RecipientScannerSheet({ isOpen, ...props }: Props) {
  const { colors } = useTheme();

  return (
    <Sheet isPresented={isOpen} height="large" containerColor={colors.bgFourth} onDismiss={props.onClose}>
      <RecipientScannerContent {...props} />
    </Sheet>
  );
}

function RecipientScannerContent({ onConfirm, onClose }: Omit<Props, 'isOpen'>) {
  const { data: currentNetwork } = useCurrentNetwork();
  const { t } = useTranslation();

  return (
    <QrScannerContent title={t('scan.title')} onConfirm={onConfirm} onClose={onClose} parseInput={(raw) => parseRecipientInput(raw, { currentNetwork, t })} />
  );
}
