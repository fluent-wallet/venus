import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, Button, Text } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';
import { withObservables } from '@nozbe/watermelondb/react';
import database from '@core/DB';
import { Vault } from '@core/DB/models/Vault';
import TableName from '@core/DB/TableName';
import { StackNavigation } from 'packages/@types/natigation';

export const WelcomeStackName = 'Welcome';

const Welcome: React.FC<{ navigation: StackNavigation; vault: Vault[] }> = ({ navigation, vault }) => {
  const { theme } = useTheme();
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
            <Text className="relative text-[16px] leading-[24px] ">Coming Soon！</Text>
            <Text className="mt-[4px] text-[14px] leading-[20px]">We are working hard to prepare, so stay tuned,Please stay tuned！</Text>
          </View>
        </View>

        <Image className="mt-[10px] mx-auto w-[208px] h-[208px]" source={WelcomeBg} />

        <View className="mt-[90px]">
          <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
            Enter Web3
          </Text>
          <Text className="mt-[8px] text-[16px] leading-[24px] text-center">First, let's add a wallet</Text>
        </View>

        <Button containerStyle={{ marginTop: 40, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')} disabled>
          Connect BSIM Wallet
        </Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')}>
          Create new Wallet
        </Button>
        <Button containerStyle={{ marginTop: 16, marginHorizontal: 16 }} onPress={() => navigation.navigate('Biometrics')}>
          Import existing Wallet
        </Button>
      </SafeAreaView>
    </LinearGradient>
  );
};

const enhance = withObservables(['vault'], ({ vault }) => ({
  vault,
}));

const EnhanceWelcome = enhance(Welcome);

export default ({navigation}) => {
  const vault = database.get<Vault>(TableName.Vault).query();
  return <EnhanceWelcome vault={vault} navigation={navigation} />;
};
