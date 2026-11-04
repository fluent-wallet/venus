import Checkbox from '@components/Checkbox';
import { SheetLayout } from '@components/Sheet';
import Text from '@components/Text';
import { Lang, setI18nLanguage, useLang } from '@hooks/useI18n';
import { useTheme } from '@react-navigation/native';
import type { LanguageStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
import { styles } from './Appearance';

const Language: React.FC<StackScreenProps<typeof LanguageStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLang();

  const setLanguage = useCallback(
    (language: Parameters<typeof setI18nLanguage>[0]) => {
      setI18nLanguage(language);
      if (navigation.canGoBack()) navigation.goBack();
    },
    [navigation],
  );

  return (
    <SheetLayout title={t('settings.language.title')}>
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
    </SheetLayout>
  );
};

export default Language;
