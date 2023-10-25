import React, { useState } from 'react';
import { SafeAreaView, TouchableHighlight, Text } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { type NavigationProp } from '@react-navigation/native';
import { useTheme, ListItem, Dialog } from '@rneui/themed';
import { resetDatabase } from '@DB/setup';
import { WelcomeStackName, AccountManageStackName } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';

export const SettingsStackName = 'Settings';

const Settings: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <SafeAreaView className="flex-1 flex flex-col gap-[12px]" style={{ backgroundColor: theme.colors.surfacePrimary, paddingTop: statusBarHeight + 16 }}>
      <TouchableHighlight onPress={() => navigation.navigate(AccountManageStackName)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.textPrimary }} className="font-bold">
              Account Manage
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.textPrimary} />
        </ListItem>
      </TouchableHighlight>

      <TouchableHighlight onPress={() => setVisible(true)}>
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: theme.colors.error }} className="font-bold">
              Clear All Data
            </ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron color={theme.colors.error} />
        </ListItem>
      </TouchableHighlight>

      <Dialog isVisible={visible} onBackdropPress={() => setVisible(false)}>
        <Dialog.Title title="Confirm clear all data?" titleStyle={{ color: theme.colors.textPrimary, fontSize: 22, fontWeight: 'bold' }} />
        <Text style={{ color: theme.colors.textSecondary }} className="text-[16px]">
          Note that this is a non-recoverable operation!
        </Text>
        <Dialog.Actions>
          <Dialog.Button
            title="Confirm"
            onPress={async () => {
              await resetDatabase();
              setVisible(false);
              showMessage({
                message: 'Clear all data successfully',
                type: 'success',
                duration: 1850,
                statusBarHeight,
              });
              navigation.navigate(WelcomeStackName);
            }}
          />
          <Dialog.Button title="Cancel" onPress={() => setVisible(false)} />
        </Dialog.Actions>
      </Dialog>
    </SafeAreaView>
  );
};

export default Settings;
