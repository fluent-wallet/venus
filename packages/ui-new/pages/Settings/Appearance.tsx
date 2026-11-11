import Checkbox from '@components/Checkbox';
import { SheetLayout } from '@components/Sheet';
import Text from '@components/Text';
import { setMode as _setMode, useMode } from '@hooks/useMode';
import { useTheme } from '@react-navigation/native';
import type { AppearanceStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

const Appearance: React.FC<StackScreenProps<typeof AppearanceStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const mode = useMode();

  const setMode = useCallback(
    (mode: Parameters<typeof _setMode>[0]) => {
      _setMode(mode);
      if (navigation.canGoBack()) navigation.goBack();
    },
    [navigation],
  );

  return (
    <SheetLayout title={t('settings.appearance.title')}>
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
    </SheetLayout>
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
