import React, { useState } from 'react';
import { SafeAreaView, Text, TouchableHighlight } from 'react-native';
import { type NavigationProp } from '@react-navigation/native';
import { showMessage } from 'react-native-flash-message';
import { useTheme, ListItem, Dialog } from '@rneui/themed';
import methods from '@core/WalletCore/Methods';
import { statusBarHeight } from '@utils/deviceInfo';
import { WelcomeStackName , AccountManageStackName} from '@router/configs';

export const SettingsStackName = 'Settings';

const Settings: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [visibleResetWallet, setVisibleResetWallet] = useState(false);

  return (
    <SafeAreaView
      className="flex-1 flex flex-col gap-[12px] px-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: statusBarHeight + 16 }}
    >
      <TouchableHighlight className="rounded-[8px] overflow-hidden" onPress={() => navigation.navigate(AccountManageStackName)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              Account Manage
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.textPrimary} />
        </ListItem>
      </TouchableHighlight>

      <TouchableHighlight className="rounded-[8px] overflow-hidden" onPress={() => setVisibleResetWallet(true)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.error }} className="font-bold">
              Reset Wallet Data
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.error} />
        </ListItem>
      </TouchableHighlight>
      <Dialog isVisible={visibleResetWallet} onBackdropPress={() => setVisibleResetWallet(false)}>
        <Dialog.Title title="Confirm reset wallet Data?" titleStyle={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: 'bold' }} />
        <Text style={{ color: theme.colors.textSecondary }} className="text-[16px]">
          Account data will be cleared and configurations such as network settings will be restored to their initial state.
        </Text>
        <Dialog.Actions>
          <Dialog.Button
            title="Confirm"
            onPress={async () => {
              try {
                await methods.resetDatabase();
                showMessage({
                  message: 'Reset wallet data successfully',
                  type: 'success',
                  duration: 2000,
                  statusBarHeight,
                });
                navigation.navigate(WelcomeStackName);
              } catch (err) {
                showMessage({
                  message: 'Reset wallet data failed',
                  description: String(err ?? ''),
                  type: 'warning',
                  duration: 1500,
                  statusBarHeight,
                });
              } finally {
                setVisibleResetWallet(false);
              }
            }}
          />
          <Dialog.Button title="Cancel" onPress={() => setVisibleResetWallet(false)} />
        </Dialog.Actions>
      </Dialog>
    </SafeAreaView>
  );
};

export default Settings;
