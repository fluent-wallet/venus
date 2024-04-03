import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { AboutUsStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE } from '@utils/features';
import SwiftShieldLogo from '@assets/icons/swift-shield.svg';
import { SettingItem } from './index';
import pkg from '../../../../package.json';

const AboutUs: React.FC<StackScreenProps<typeof AboutUsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <SwiftShieldLogo style={styles.logo} />
      <Text style={[styles.swiftshield, { color: colors.textPrimary }]}>SwiftShield Wallet</Text>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        App version: {pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>

      <SettingItem title="Check for updates" onPress={() => {}} />
      <SettingItem title="Terms of Service" onPress={() => {}} />
      <SettingItem title="Feedback" onPress={() => {}} />
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
