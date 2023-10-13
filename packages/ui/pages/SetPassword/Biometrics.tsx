import React, { useEffect } from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, useThemeMode, Button, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat } from 'react-native-reanimated';
import FaceIdSource from '@assets/images/face-id.png';

const getFaceIdLinearColor = (themeMode: 'dark' | 'light') =>
  themeMode === 'dark' ? ['rgba(174, 207, 250, 0.2)', 'rgba(171, 194, 255, 0)'] : ['#AECFFA', 'rgba(171, 194, 255, 0)'];
const FaceId: React.FC = () => {
  const { theme } = useTheme();
  const height = useSharedValue(-210);
  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{ translateY: -height.value }],
  }));

  useEffect(() => {
    height.value = withRepeat(
      withTiming(-88, {
        duration: 1500,
      }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="relative mx-auto w-[193px] h-[210px] rounded-[20px] overflow-hidden">
      <Animated.View className="absolute w-[193px] h-[210px] bottom-0" style={animatedStyles}>
        <LinearGradient colors={getFaceIdLinearColor(theme.mode)} className="flex-1" />
      </Animated.View>
      <Image source={FaceIdSource} />
    </View>
  );
};

const Biometrics: React.FC = () => {
  const { theme } = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
        <FaceId />
        <View className="mt-[90px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
            Enable FaceId
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center">
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
