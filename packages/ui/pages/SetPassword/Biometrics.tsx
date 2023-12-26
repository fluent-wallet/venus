import React, { useEffect, useCallback, useState } from 'react';
import { View, Image, SafeAreaView } from 'react-native';
import { RouteProp, CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import { showMessage, hideMessage } from 'react-native-flash-message';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat } from 'react-native-reanimated';
import { useTheme, Text } from '@rneui/themed';
import plugins from '@core/WalletCore/Plugins';
import { statusBarHeight } from '@utils/deviceInfo';
import useInAsync from '@hooks/useInAsync';
import { BaseButton } from '@components/Button';
import { type RootStackList, type StackNavigation, WalletStackName, BiometricsStackName, HomeStackName, SetPasswordStackName } from '@router/configs';
import createVaultWithRouterParams from './createVaultWithRouterParams';
import FaceIdSource from '@assets/images/face-id.png';

export const showBiometricsDisabledMessage = () => {
  showMessage({
    message: 'Device biometrics not enabled',
    description: 'Please enable your biometrics in device settings.',
    type: 'warning',
    duration: 3500,
    statusBarHeight,
  });
};

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

  const { inAsync: loading, execAsync: createVault } = useInAsync(createVaultWithRouterParams);

  const handleEnableBiometrics = useCallback(async () => {
    try {
      navigation.setOptions({ gestureEnabled: false });
      const supportedBiometryType = await plugins.Authentication.getSupportedBiometryType();
      if (supportedBiometryType === null) {
        showBiometricsDisabledMessage();
        return;
      }

      setDisableSetPassword(true);
      await plugins.Authentication.setPassword({ authType: plugins.Authentication.AuthenticationType.Biometrics });

      if (await createVault(route.params)) {
        navigation.navigate(HomeStackName, { screen: WalletStackName });
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: HomeStackName }] }));
      }
    } catch (err) {
      // console.log('Enable Biometrics error: ', err);
      setDisableSetPassword(false);
    } finally {
      navigation.setOptions({ gestureEnabled: true });
    }
  }, [createVault, navigation, route.params]);

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <SafeAreaView className="flex-1 flex flex-col justify-start" style={{ paddingTop: statusBarHeight + 48 }}>
        <FaceId />
        <View className="mt-[90px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
            Enable Biometrics
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center">
            Enable Biometrics to access wallet.
            {'\n'}
            {'\n'}
            After enabled, you can unlock wallets or
            {'\n'}
            make transactions by verifying your Biometrics...
          </Text>
        </View>

        <BaseButton testID="enable" loading={loading} containerStyle={{ marginTop: 32, marginHorizontal: 16 }} onPress={handleEnableBiometrics}>
          Enable
        </BaseButton>
        <BaseButton
          testID="setPassword"
          containerStyle={{ marginTop: 16, marginHorizontal: 16 }}
          onPress={() => {
            if (disableSetPassword) return;
            hideMessage();
            navigation.navigate(SetPasswordStackName, route.params);
          }}
        >
          Set Password
        </BaseButton>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Biometrics;
