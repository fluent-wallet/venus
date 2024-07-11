import BottomSheet, { snapPoints, BottomSheetWrapper, BottomSheetContent, BottomSheetHeader, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import NetworksList from '@modules/NetworksList';
import { useTheme } from '@react-navigation/native';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { styles } from '../AccountSelector';
export type { BottomSheetMethods };

interface Props {
  onClose: () => void;
}

const NetworkSelector: React.FC<Props> = ({ onClose }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const handleSelect = useCallback(() => {
    bottomSheetRef?.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints.percent75} index={0} onClose={onClose}>
      <BottomSheetWrapper>
        <BottomSheetHeader title={t('common.network')}>
          <Pressable
            testID="edit"
            style={({ pressed }) => [styles.edit, { borderColor: colors.borderThird, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('common.edit')}</Text>
          </Pressable>
        </BottomSheetHeader>
        <BottomSheetContent>
          <NetworksList type="selector" onSelect={handleSelect} />
        </BottomSheetContent>
      </BottomSheetWrapper>
    </BottomSheet>
  );
};

export default NetworkSelector;
