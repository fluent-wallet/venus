import React, { useCallback } from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Text from '@components/Text';
import { AboutUsStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE } from '@utils/features';
import { Lang, useLanguage } from '@hooks/useI18n';
import SwiftShieldLogo from '@assets/icons/swift-shield.webp';
import { SettingItem } from './index';
import pkg from '../../../../package.json';
import { Image } from 'expo-image';

const AboutUs: React.FC<StackScreenProps<typeof AboutUsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const lang = useLanguage();

  const openTeamsService = useCallback(() => {
    Linking.openURL('https://swiftshield.tech/terms.html');
  }, []);

  const openFeedback = useCallback(() => {
    if (lang === Lang.zhHant) {
      Linking.openURL('https://v4deu0ke8sn.typeform.com/to/szRxg7sS');
    } else {
      Linking.openURL('https://v4deu0ke8sn.typeform.com/to/q41dMm2o');
    }
  }, [lang]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Image source={SwiftShieldLogo} style={styles.logo} />

      <Text style={[styles.swiftshield, { color: colors.textPrimary }]}>{t('settings.aboutUs.title')}</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        {t('settings.aboutUs.version')}: {pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>

      {/* <SettingItem title={t('settings.aboutUs.action.checkUpdate')} onPress={() => {}} /> */}
      <SettingItem title={t('settings.aboutUs.action.teamsService')} onPress={openTeamsService} />
      <SettingItem title={t('settings.aboutUs.action.feedback')} onPress={openFeedback} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  logo: {
    width: 72,
    aspectRatio: 1,
    margin: 44,
    alignSelf: 'center',
  },
  swiftshield: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  version: {
    marginBottom: 32,
    fontWeight: '300',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default AboutUs;
