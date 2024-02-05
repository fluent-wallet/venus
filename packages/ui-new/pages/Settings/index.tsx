import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import methods from '@core/WalletCore/Methods';
import Button from '@components/Button';
import Text from '@components/Text';
import { SettingsStackName, WelcomeStackName, type StackScreenProps } from '@router/configs';
import { APP_VERSION_FLAG_FEATURE, RESET_WALLET_DATA_FEATURE } from '@utils/features';
import pkg from '../../../../package.json';

const Settings: React.FC<StackScreenProps<typeof SettingsStackName>> = ({ navigation }) => {
  const { colors } = useTheme();

  const handleClearAccoutData = useCallback(async () => {
    try {
      await methods.clearAccountData();
      showMessage({
        message: 'Reset wallet data successfully',
        type: 'success',
      });
      navigation.navigate(WelcomeStackName);
    } catch (err) {
      showMessage({
        message: 'Reset wallet data failed',
        description: String(err ?? ''),
        type: 'warning',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Button onPress={handleClearAccoutData}>Clear Account Data</Button>
      <Text style={{ color: colors.textSecondary }}>
        v{pkg.version} Beta
        {APP_VERSION_FLAG_FEATURE.allow && APP_VERSION_FLAG_FEATURE.value}
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
});

export default Settings;
