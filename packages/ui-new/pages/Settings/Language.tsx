import React, { useCallback, useRef } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import Checkbox from '@components/Checkbox';
import BottomSheet, { type BottomSheetMethods } from '@components/BottomSheet';
import { styles as bottomSheetStyle, snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { LanguageStackName, type StackScreenProps } from '@router/configs';
import { styles } from './Appearance';
import { Lang, setI18nLanguage, useLang } from '@hooks/useI18n';
import { useTranslation } from 'react-i18next';

const Language: React.FC<StackScreenProps<typeof LanguageStackName>> = () => {
  const { colors } = useTheme();
  const lang = useLang();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);
  const { t } = useTranslation();
  const setLanguage = useCallback((language: Parameters<any>) => {
    // _setMode(mode);
    bottomSheetRef.current?.close();
  }, []);
  console.log('current lang', lang);
  return (
    <BottomSheet snapPoints={snapPoints} isRoute containerStyle={bottomSheetStyle.container}>
      <Text style={[bottomSheetStyle.title, { color: colors.textPrimary }]}>{t('settings.language.title')}</Text>

      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => setI18nLanguage(Lang.system)}
        testID="system"
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>{t('settings.language.systemLang')}</Text>
        {lang === Lang.system && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        onPress={() => setI18nLanguage(Lang.en)}
        testID="english"
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>English</Text>
        {lang === Lang.en && <Checkbox checked pointerEvents="none" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]}
        testID="traditionalChinese"
        onPress={() => setI18nLanguage(Lang.zhHant)}
      >
        <Text style={[styles.itemText, { color: colors.textPrimary }]}>繁体中文</Text>
        {lang === Lang.zhHant && <Checkbox checked pointerEvents="none" />}
      </Pressable>
    </BottomSheet>
  );
};

export default Language;
