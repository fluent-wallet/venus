import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { SettingsStackName, AccountManagementStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE } from '@utils/features';
import { SettingItem } from './index';
import pkg from '../../../../package.json';

const Settings: React.FC<StackScreenProps<typeof SettingsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        v{pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>

      <SettingItem title="Preferences" onPress={() => {}} />
      <SettingItem title="Account Management" onPress={() => navigation.navigate(AccountManagementStackName)} />
      <SettingItem title="Network Management" onPress={() => {}} />
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
  version: {
    marginTop: 'auto',
    marginBottom: 32,
    textAlign: 'center',
  },
});

export default Settings;
