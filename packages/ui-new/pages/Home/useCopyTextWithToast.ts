import Clipboard from '@react-native-clipboard/clipboard';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';

export function useCopyTextWithToast() {
  const { t } = useTranslation();

  return useCallback(
    (value: string | null | undefined) => {
      Clipboard.setString(value ?? '');
      showMessage({
        message: t('common.copied'),
        type: 'success',
        duration: 1500,
        width: 160,
      });
    },
    [t],
  );
}
