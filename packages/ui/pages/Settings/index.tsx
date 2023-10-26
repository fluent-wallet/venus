import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, TouchableHighlight } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { type NavigationProp } from '@react-navigation/native';
import { useTheme, ListItem, Dialog } from '@rneui/themed';
import { resetDatabase, clearAccountData } from '@DB/setup';
import { WelcomeStackName, AccountManageStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';

export const SettingsStackName = 'Settings';

const Settings: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [visibleClearAccount, setVisibleClearAccount] = useState(false);
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

      <TouchableHighlight className="rounded-[8px] overflow-hidden" onPress={() => setVisibleClearAccount(true)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.error }} className="font-bold">
              Clear Account Data
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.error} />
        </ListItem>
      </TouchableHighlight>
      <Dialog isVisible={visibleClearAccount} onBackdropPress={() => setVisibleClearAccount(false)}>
        <Dialog.Title title="Confirm clear account data?" titleStyle={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: 'bold' }} />
        <Text style={{ color: theme.colors.textSecondary }} className="text-[16px]">
          Account data will be cleared, but network settings and other configurations will remain.
        </Text>
        <Dialog.Actions>
          <Dialog.Button
            title="Confirm"
            onPress={async () => {
              try {
                await clearAccountData();
                showMessage({
                  message: 'Clear account data successfully',
                  type: 'success',
                  duration: 1500,
                  statusBarHeight,
                });
                navigation.navigate(WelcomeStackName);
              } catch (err) {
                await clearAccountData();
                showMessage({
                  message: 'Clear account data failed',
                  description: String(err ?? ''),
                  type: 'warning',
                  duration: 2000,
                  statusBarHeight,
                });
              } finally {
                setVisibleClearAccount(false);
              }
            }}
          />
          <Dialog.Button title="Cancel" onPress={() => setVisibleClearAccount(false)} />
        </Dialog.Actions>
      </Dialog>

      <TouchableOpacity className="rounded-[8px] overflow-hidden" onPress={() => setVisibleClearAccount(true)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.error }} className="font-bold">
              Reset Wallet Data
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.error} />
        </ListItem>
      </TouchableOpacity>
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
                await resetDatabase();
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
