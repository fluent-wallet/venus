import Sheet, { SheetHeader } from '@components/Sheet';
import { useTheme } from '@react-navigation/native';
import type { AssetInfo } from '@utils/assetInfo';
import { type ComponentProps, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'react-native';
import AssetSelectorContent from './AssetSelectorContent';

type Props = {
  isOpen: boolean;
  height?: ComponentProps<typeof Sheet>['height'];
  onConfirm: (asset: AssetInfo) => void;
  onClose: () => void;
};

export default function AssetSelector({ isOpen, height = 'large', onConfirm, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const handleSelectAsset = useCallback(
    (asset: AssetInfo) => {
      onConfirm(asset);
      Keyboard.dismiss();
      onClose();
    },
    [onConfirm, onClose],
  );

  return (
    <Sheet isPresented={isOpen} height={height} containerColor={colors.bgFourth} onDismiss={onClose}>
      <SheetHeader title={t('receive.title')} />
      <AssetSelectorContent selectType="Receive" onSelectAsset={handleSelectAsset} />
    </Sheet>
  );
}
