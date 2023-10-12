import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { NavigationProp } from '@react-navigation/native';
import { useTheme, useThemeMode, Button, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';

const Welcome: React.FC<{ navigation: NavigationProp<any> }> = ({ navigation }) => {
  const { theme } = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        <View
          className="flex flex-row w-[330px] mx-auto p-[12px] rounded-[8px]"
          style={{ marginTop: (statusBarHeight ?? 0) + 8, backgroundColor: theme.colors.surfaceSecondary }}
        >
          <View className="mt-[5px] mr-[8px]">
            <Tip />
          </View>
          <View>
            <Text className="relative text-[16px] leading-[24px] font-medium font-sfp" style={{ color: theme.colors.textPrimary }}>
              Coming Soon！
            </Text>
            <Text className="mt-[4px] text-[14px] leading-[20px] font-sfp" style={{ color: theme.colors.textPrimary }}>
              We are working hard to prepare, so stay tuned,Please stay tuned！
            </Text>
          </View>
        </View>

        <Image className="mt-[10px] mx-auto w-[208px] h-[208px]" source={WelcomeBg} />

        <View className="mt-[90px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center font-sfp" style={{ color: theme.colors.textBrand }}>
            Enter Web3
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center font-sfp" style={{ color: theme.colors.textPrimary }}>
            First, let's add a wallet
          </Text>
        </View>

        <Button containerStyle={{ marginTop: 40, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')}>
          Connect BSIM Wallet
        </Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')}>
          Create new Wallet
        </Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')}>
          Import existing Wallet
        </Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          Toggle Mode
        </Button>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Welcome;
