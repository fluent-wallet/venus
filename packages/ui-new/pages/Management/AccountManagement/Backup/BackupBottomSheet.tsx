import { BottomSheetHeader, BottomSheetRoute, BottomSheetWrapper, snapPoints as defaultSnapPoints } from '@components/BottomSheet';
import type React from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

interface Props extends ComponentProps<typeof BottomSheetRoute> {
  children: React.ReactNode;
  showTitle?: boolean;
  title?: string;
}

const BackupBottomSheet: React.FC<Props> = ({ children, snapPoints, showTitle = true, title, ...props }) => {
  const { t } = useTranslation();

  return (
    <BottomSheetRoute snapPoints={snapPoints || defaultSnapPoints.large} {...props}>
      <BottomSheetWrapper innerPaddingHorizontal>
        {showTitle && <BottomSheetHeader title={title || t('backup.title')} />}
        {children}
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export default BackupBottomSheet;
