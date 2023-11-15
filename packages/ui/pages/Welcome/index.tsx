import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, Text } from '@rneui/themed';
import { BaseButton } from '@components/Button';
import { statusBarHeight } from '@utils/deviceInfo';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';
import { useStructureGroupData } from '@core/plugins/ReactInject';
import WalletCore from '@core/WalletCore';

export const WelcomeStackName = 'Welcome';

const Welcome: React.FC = () => {
  const { theme } = useTheme();
  const accountGroups = useStructureGroupData();
  // console.log('accountGroups', accountGroups[0].id, accountGroups[0]);

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        {accountGroups?.map((accountGroup) => (
          <View key={accountGroup.id}>
            <Text className="text-[36px] leading-[46px] font-bold text-center" style={{ color: theme.colors.textBrand }}>
              {accountGroup.nickname}
            </Text>
            {accountGroup.accounts.map((account) => (
              <Text key={account.id}>
                {account.nickname} {account.currentNetworkAddressValue}
              </Text>
            ))}
          </View>
        ))}
        <BaseButton containerStyle={{ marginTop: 40, marginHorizontal: 16 }} onPress={() => WalletCore.methods.createHDVault()}>
          Create new Wallet
        </BaseButton>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Welcome;
