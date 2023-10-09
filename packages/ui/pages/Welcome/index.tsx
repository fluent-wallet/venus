import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { StatusBar, View, Text } from 'react-native';

const Welcome: React.FC = () => {
  return (
    <LinearGradient colors={['#001C69', '#000000']} className="flex-1">
      <StatusBar translucent backgroundColor="transparent" />
      <View className="flex-1">
        <Text className="text-primary-light dark:text-primary-dark"> Text Primary </Text>

        <Text className="text-surface-primary-light dark:text-surface-primary-dark">Surface Primary</Text>

        <Text className="border-primary-light dark:border-primary-dark"> Border Primary</Text>

        <Text className="text-warn-success-primary-light dark:text-warn-success-primary-dark">Warn Success Primary</Text>

        <Text className="text-warn-error-primary-light dark:text-warn-error-primary-dark">Warn error Primary</Text>

        <Text className="text-gray5">Common Color</Text>
      </View>
    </LinearGradient>
  );
};

export default Welcome;
