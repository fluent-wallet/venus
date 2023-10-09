import { StatusBar, useColorScheme, View, Text } from 'react-native';

function Welcome() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <Text className="text-primary-light dark:text-primary-dark"> Text Primary </Text>

      <Text className="text-surface-primary-light dark:text-surface-primary-dark">Surface Primary</Text>

      <Text className="border-primary-light dark:border-primary-dark"> Border Primary</Text>

      <Text className="text-warn-success-primary-light dark:text-warn-success-primary-dark">Warn Success Primary</Text>

      <Text className="text-warn-error-primary-light dark:text-warn-error-primary-dark">Warn error Primary</Text>

      <Text className="text-gray5">Common Color</Text>
    </View>
  );
}

export default Welcome;
