import React, { useCallback, useRef } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { styles as bottomSheetStyle, snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { LanguageStackName, type StackScreenProps } from '@router/configs';
import { Lang, setI18nLanguage, useLang } from '@hooks/useI18n';
import { styles } from './Appearance';

const Language: React.FC<StackScreenProps<typeof LanguageStackName>> = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLang();

  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const setLanguage = useCallback((language: Parameters<typeof setI18nLanguage>[0]) => {
    setI18nLanguage(language);
    bottomSheetRef.current?.close();
  }, []);

  return (
    <BottomSheet ref={bottomSheetRef} snapPoints={snapPoints} isRoute containerStyle={bottomSheetStyle.container}>
      <Text style={[bottomSheetStyle.title, { color: colors.textPrimary }]}>{t('settings.language.title')}</Text>

      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => setLanguage(Lang.system)}
        testID="system"
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>{t('settings.language.systemLang')}</Text>
        {lang === Lang.system && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => setLanguage(Lang.en)}
        testID="english"
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>English</Text>
        {lang === Lang.en && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        testID="traditionalChinese"
        onPress={() => setLanguage(Lang.zhHant)}
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>繁体中文</Text>
        {lang === Lang.zhHant && <Checkbox checked pointerEvents="none" />}
      </Pressable>
    </BottomSheet>
  );
};

export default Language;
