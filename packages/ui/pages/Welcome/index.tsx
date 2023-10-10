import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { StatusBar, View, Text } from 'react-native';
import { useTheme } from '@rneui/themed';
import Tip from '@assets/icons/tip.svg';

const Welcome: React.FC = () => {
  const { theme } = useTheme();
  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <StatusBar translucent backgroundColor="transparent" />
      <View className="flex-1 pt-[32px]">
        <Tip />
        <Text className="text-[16px] lh-[24px] font-medium text-white">Coming Soon！</Text>
        <Text className="text-[14px] lh-[20px]">We are working hard to prepare, so stay tuned,Please stay tuned！</Text>
      </View>
    </LinearGradient>
  );
};

export default Welcome;
