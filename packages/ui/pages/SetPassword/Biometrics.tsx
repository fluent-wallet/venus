import React, { useEffect, useCallback, useState } from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, Button, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat } from 'react-native-reanimated';
import FaceIdSource from '@assets/images/face-id.png';
import { authentication, AuthenticationType } from '@DB/helper';
import { WalletStackName, type RootStackList, type StackNavigation } from '@router/configs';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import useInAsync from '@hooks/useInAsync';
import { SetPasswordStackName, createVaultWithType } from './index';

export const BiometricsStackName = 'Biometrics';

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
    <View className="relative mx-auto w-[189px] h-[189px] rounded-[20px] overflow-hidden">
      <Animated.View className="absolute w-[189px] h-[189px] bottom-0" style={animatedStyles}>
        <LinearGradient colors={getFaceIdLinearColor(theme.mode)} className="flex-1" />
      </Animated.View>
      <Image source={FaceIdSource} className="w-full h-full" />
    </View>
  );
};

const Biometrics = () => {
  const { theme } = useTheme();
  const [disableSetPassword, setDisableSetPassword] = useState(false);

  const navigation = useNavigation<StackNavigation>();
  const route = useRoute<RouteProp<RootStackList, typeof BiometricsStackName>>();
  const { inAsync: loading, execAsync: createVault } = useInAsync(createVaultWithType);
  const handleEnableBiometrics = useCallback(async () => {
    try {
      setDisableSetPassword(true);
      await authentication.setPassword({ authType: AuthenticationType.Biometrics });
      await createVault(route.params);
      navigation.navigate('Home', { screen: WalletStackName });
    } catch (err) {
      console.log('Enable Biometrics error: ', err);
      setDisableSetPassword(false);
    }
  }, [createVault, navigation, route.params]);

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

        <Button loading={loading} containerStyle={{ marginTop: 32, marginHorizontal: 16 }} onPress={handleEnableBiometrics}>
          Enable
        </Button>
        <Button
          disabled={disableSetPassword}
          containerStyle={{ marginTop: 16, marginHorizontal: 16 }}
          onPress={() => navigation.navigate(SetPasswordStackName, route.params)}
        >
          Set Password
        </Button>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Biometrics;
