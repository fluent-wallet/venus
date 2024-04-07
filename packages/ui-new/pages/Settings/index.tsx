import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Text from '@components/Text';
import { SettingsStackName, AccountManagementStackName, PreferencesStackName, AboutUsStackName, type StackScreenProps } from '@router/configs';
import Arrow from '@assets/icons/arrow-right2.svg';

export const SettingItem: React.FC<{ title: string; onPress: () => void }> = ({ title, onPress }) => {
  const { colors } = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.underlay : 'transparent' }]} onPress={onPress}>
      <Text style={[styles.itemText, { color: colors.textPrimary }]}>{title}</Text>
      <Arrow style={styles.arrow} color={colors.iconPrimary} fontSize={32} />
    </Pressable>
  );
};

const Settings: React.FC<StackScreenProps<typeof SettingsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>

      <SettingItem title="Preferences" onPress={() => navigation.navigate(PreferencesStackName)} />
      <SettingItem title="Account Management" onPress={() => navigation.navigate(AccountManagementStackName)} />
      {/* <SettingItem title="Network Management" onPress={() => {}} /> */}
      <SettingItem title="About us" onPress={() => navigation.navigate(AboutUsStackName)} />
    </ScrollView>
  );
};

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    marginBottom: 22,
    marginHorizontal: 18,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
  },
  item: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: 32,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '300',
  },
  arrow: {},
});

export default Settings;
