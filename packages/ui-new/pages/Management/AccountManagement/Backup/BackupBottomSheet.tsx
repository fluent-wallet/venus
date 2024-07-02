import BottomSheet, { snapPoints as defaultSnapPoints, BottomSheetWrapper, BottomSheetHeader } from '@components/BottomSheet';
import type React from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

interface Props extends ComponentProps<typeof BottomSheet> {
  children: React.ReactNode;
  showTitle?: boolean;
}

const BackupBottomSheet: React.FC<Props> = ({ children, snapPoints, showTitle = true, ...props }) => {
  const { t } = useTranslation();

  return (
    <BottomSheet snapPoints={snapPoints || defaultSnapPoints.large} isRoute {...props}>
      <BottomSheetWrapper innerPaddingHorizontal>
        {showTitle && <BottomSheetHeader title={t('backup.title')} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

export default BackupBottomSheet;
