import { BottomSheetWrapper, BottomSheetHeader, BottomSheetContent, type BottomSheetMethods, BottomSheetRoute } from '@components/BottomSheet';
import Checkbox from '@components/Checkbox';
import Text from '@components/Text';
import { Lang, setI18nLanguage, useLang } from '@hooks/useI18n';
import { snapPoints } from '@pages/Management/AccountManagement/AddAnotherWallet';
import { useTheme } from '@react-navigation/native';
import type { LanguageStackName, StackScreenProps } from '@router/configs';
import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';
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
    <BottomSheetRoute ref={bottomSheetRef} snapPoints={snapPoints}>
      <BottomSheetWrapper>
        <BottomSheetHeader title={t('settings.language.title')} />
        <BottomSheetContent>
          <Pressable
            style={({ pressed }) => [styles.item, { marginTop: 20, backgroundColor: pressed ? colors.underlay : 'transparent' }]}
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
        </BottomSheetContent>
      </BottomSheetWrapper>
    </BottomSheetRoute>
  );
};

export default Language;
