import Text from '@components/Text';
import { useTheme } from '@react-navigation/native';
import { AppearanceStackName, LanguageStackName, type PreferencesStackName, type StackScreenProps } from '@router/configs';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { SettingItem, styles } from './index';

const Preferences: React.FC<StackScreenProps<typeof PreferencesStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('settings.preferences.title')}</Text>

      <SettingItem title={t('settings.preferences.navigation.language')} onPress={() => navigation.navigate(LanguageStackName)} />
      <SettingItem title={t('settings.preferences.navigation.appearance')} onPress={() => navigation.navigate(AppearanceStackName)} />
    </ScrollView>
  );
};

export default Preferences;
