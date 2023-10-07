import type { PropsWithChildren } from 'react';
import { ScrollView, StatusBar, useColorScheme, View, Text } from 'react-native';
import { DebugInstructions, Header, LearnMoreLinks, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

function SetPassword() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Text> Welcome </Text>
    </View>
  );
}

export default SetPassword;
