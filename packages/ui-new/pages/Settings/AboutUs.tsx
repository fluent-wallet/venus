import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { AboutUsStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE } from '@utils/features';
import SwiftShieldLogo from '@assets/icons/swift-shield.svg';
import { SettingItem } from './index';
import pkg from '../../../../package.json';
import { useTranslation } from 'react-i18next';

const AboutUs: React.FC<StackScreenProps<typeof AboutUsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <SwiftShieldLogo style={styles.logo} />
      <Text style={[styles.swiftshield, { color: colors.textPrimary }]}>{t('settings.aboutUs.title')}</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        {t('settings.aboutUs.version')}: {pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>

      <SettingItem title={t('settings.aboutUs.action.checkUpdate')} onPress={() => {}} />
      <SettingItem title={t('settings.aboutUs.action.teamsService')} onPress={() => {}} />
      <SettingItem title={t('settings.aboutUs.action.feedback')} onPress={() => {}} />
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
    marginVertical: 44,
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
