import React from 'react';
import { ScrollView, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import Button from '@components/Button';
import Text from '@components/Text';
import { SettingsStackName, AccountManagementStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE, RESET_WALLET_DATA_FEATURE } from '@utils/features';
import Arrow from '@assets/icons/arrow-right2.svg';
import pkg from '../../../../package.json';

const SettingItem: React.FC<{ title: string; onPress: () => void }> = ({ title, onPress }) => {
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

  // const handleClearAccoutData = useCallback(async () => {
  //   try {
  //     await methods.resetDatabase();
  //     showMessage({
  //       message: 'Reset wallet data successfully',
  //       type: 'success',
  //     });
  //     navigation.navigate(WelcomeStackName);
  //   } catch (err) {
  //     showMessage({
  //       message: 'Reset wallet data failed',
  //       description: String(err ?? ''),
  //       type: 'warning',
  //     });
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>⚙️ Settings</Text>

      <SettingItem title="Account Management" onPress={() => navigation.navigate(AccountManagementStackName)} />
      <SettingItem title="Network Management" onPress={() => {}} />
      <SettingItem title="Feedback" onPress={() => {}} />
      <SettingItem title="About us" onPress={() => {}} />

      <Text style={[styles.version, { color: colors.textSecondary }]}>
        v{pkg.version} {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>
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
  title: {
    marginBottom: 4,
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
  version: {
    marginTop: 'auto',
    marginBottom: 32,
    textAlign: 'center',
  },
});

export default Settings;
