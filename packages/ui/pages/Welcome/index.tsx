import { StatusBar, useColorScheme, View, Text } from 'react-native';
import { Button } from '@rneui/themed';
import { Button as BaseButton } from '@rneui/base';

function WarpButton() {
  const mode = useColorScheme();
  return <BaseButton title={'Warp Button'} buttonStyle={{ backgroundColor: mode === 'light' ? '#4572EC' : '#537FF6', borderRadius: 40 }} />;
}

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

      <Button uppercase title={'Theme Button'}></Button>
      <WarpButton />
      <BaseButton titleStyle={{ fontSize: 20 }} title={'Base Button'}></BaseButton>
    </View>
  );
}

export default Welcome;
