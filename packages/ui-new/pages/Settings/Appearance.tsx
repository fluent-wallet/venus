import React, { useCallback, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { styles as bottomSheetStyle, snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { AppearanceStackName, type StackScreenProps } from '@router/configs';
import { setMode as _setMode, useMode } from '@hooks/useMode';
import { useTranslation } from 'react-i18next';

const Appearance: React.FC<StackScreenProps<typeof AppearanceStackName>> = () => {
  const { colors } = useTheme();
  const mode = useMode();
  const { t } = useTranslation();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const setMode = useCallback((mode: Parameters<typeof _setMode>[0]) => {
    _setMode(mode);
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute containerStyle={bottomSheetStyle.container}>
      <Text style={[bottomSheetStyle.title, { color: colors.textPrimary }]}>{t('settings.appearance.title')}</Text>

      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
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
    </BottomSheet>
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
