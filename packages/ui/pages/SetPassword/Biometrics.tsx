import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { StatusBar, View, Text, Image, SafeAreaView } from 'react-native';
import { useTheme, useThemeMode, Button } from '@rneui/themed';
import FaceId from '@assets/images/face-id.png';

const Biometrics: React.FC = () => {
  const { theme } = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <StatusBar translucent backgroundColor="transparent" barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        <Image className="mt-[44px] mx-auto w-[193px] h-[210px]" source={FaceId} />

        <View className="mt-[90px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
            Enable FaceId
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center" style={{ color: theme.colors.textPrimary }}>
            Enable FaceID to access wallet.
            {'\n'}
            {'\n'}
            After enabled, you can unlock wallets or
            {'\n'}
            make transactions by verifying your Face ID...
          </Text>
        </View>

        <Button containerStyle={{ marginTop: 32, marginHorizontal: 16 }}>Enable</Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }}>Set Password</Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          Toggle Mode
        </Button>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Biometrics;
