import { StatusBar, useColorScheme, View, Text } from 'react-native';

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
