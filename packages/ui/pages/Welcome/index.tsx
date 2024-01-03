import React from 'react';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { BaseButton } from '@components/Button';
import Background from '@modules/Background';
import { type StackNavigation, ImportWalletStackName, BiometricsStackName } from '@router/configs';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';
import SIMCardIcon from '@assets/icons/sim-card.svg';

const Welcome: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  return (
    <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
      <Background className="flex-1">
        {/* <View
          className="flex flex-row w-[330px] mx-auto p-[12px] rounded-[8px]"
          style={{ marginTop: (statusBarHeight ?? 0) + 8, backgroundColor: theme.colors.surfaceSecondary }}
        >
          <View className="mt-[5px] mr-[8px]">
            <Tip />
          </View>
          <View>
            <Text className="text-[16px] leading-[24px] ">Coming Soon！</Text>
            <Text className="mt-[4px] text-[14px] leading-[20px]">We are working hard to prepare, so stay tuned,Please stay tuned！</Text>
          </View>
        </View> */}

        <Image className="mt-[58px] mx-auto w-[208px] h-[208px]" source={WelcomeBg} />

        <View className="mt-[56px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
            Enter Web3
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center">First, let's add a wallet</Text>
        </View>

        <BaseButton
          testID="connectBSIMWallet"
          containerStyle={{ marginTop: 40, marginHorizontal: 16 }}
          onPress={() => navigation.navigate(BiometricsStackName, { type: 'BSIM' })}
        >
          <SIMCardIcon color={theme.colors.surfaceCard} width={24} height={24} /> Connect BSIM Wallet
        </BaseButton>

        <View className="flex flex-row justify-center items-center my-[28px]">
          <View className="w-1/4 h-[1px] pointer-events-none" style={{ backgroundColor: theme.colors.textBrand }} />
          <Text style={{ color: theme.colors.textBrand }} className="mx-[10px] text-sm">
            or connect with
          </Text>
          <View className="w-1/4 h-[1px] pointer-events-none" style={{ backgroundColor: theme.colors.textBrand }} />
        </View>

        <BaseButton
          disabled={!__DEV__}
          testID="createNewWallet"
          containerStyle={{ marginTop: 16, marginHorizontal: 16 }}
          onPress={() => navigation.navigate(BiometricsStackName)}
        >
          Create new Wallet
        </BaseButton>
        <BaseButton
          disabled={!__DEV__}
          testID="importExistingWallet"
          containerStyle={{ marginTop: 16, marginHorizontal: 16 }}
          onPress={() => navigation.navigate(ImportWalletStackName, { type: 'create' })}
        >
          Import existing Wallet
        </BaseButton>
      </Background>
    </SafeAreaView>
  );
};

export default Welcome;
