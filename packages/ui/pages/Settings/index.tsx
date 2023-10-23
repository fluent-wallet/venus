import React from 'react';
import { View, SafeAreaView, Text } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useTheme, ListItem } from '@rneui/themed';

export const SettingsStackName = 'Settings';
const Settings: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.surfaceSecondary }}>
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        <ListItem>
          <ListItem.Content>
            <ListItem.Title style={{ color: 'white', fontWeight: 'bold' }}>
              <Text>Vice Chairman</Text>
            </ListItem.Title>
            <ListItem.Subtitle style={{ color: 'white' }}>
              <Text>Vice Chairman</Text>
            </ListItem.Subtitle>
          </ListItem.Content>
          <ListItem.Chevron color="white" />
        </ListItem>
      </SafeAreaView>
    </View>
  );
};

export default Settings;
