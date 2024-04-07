import React from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { PreferencesStackName, AppearanceStackName, LanguageStackName, type StackScreenProps } from '@router/configs';
import { SettingItem, styles } from './index';

const Preferences: React.FC<StackScreenProps<typeof PreferencesStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Preferences</Text>

      <SettingItem title="Language" onPress={() => navigation.navigate(LanguageStackName)} />
      <SettingItem title="Appearance" onPress={() => navigation.navigate(AppearanceStackName)} />
    </ScrollView>
  );
};

export default Preferences;
