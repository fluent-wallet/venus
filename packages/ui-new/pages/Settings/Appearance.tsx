import { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, type BottomSheetMethods, BottomSheetRoute } from '@components/BottomSheet';
import Checkbox from '@components/Checkbox';
import Text from '@components/Text';
import { setMode as _setMode, useMode } from '@hooks/useMode';
import { snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { useTheme } from '@react-navigation/native';
import type { AppearanceStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

const Appearance: React.FC<StackScreenProps<typeof AppearanceStackName>> = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const mode = useMode();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const setMode = useCallback((mode: Parameters<typeof _setMode>[0]) => {
    _setMode(mode);
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints}>
      <BottomSheetWrapper>
        <BottomSheetHeader title={t('settings.appearance.title')} />
        <BottomSheetContent>
          <Pressable
            style={({ pressed }) => [styles.item, { marginTop: 20, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={mode === 'system'}
            onPress={() => setMode('system')}
            testID="system"
          >
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>{t('settings.appearance.system')}</Text>
            {mode === 'system' && <Checkbox checked pointerEvents="none" />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={mode === 'light'}
            onPress={() => setMode('light')}
            testID="light"
          >
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>{t('settings.appearance.light')}</Text>
            {mode === 'light' && <Checkbox checked pointerEvents="none" />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
            disabled={mode === 'dark'}
            onPress={() => setMode('dark')}
            testID="dark"
          >
            <Text style={[styles.itemText, { color: colors.textPrimary }]}>{t('settings.appearance.dark')}</Text>
            {mode === 'dark' && <Checkbox checked pointerEvents="none" />}
          </Pressable>
        </BottomSheetContent>
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 18,
  },
});

export default Appearance;
