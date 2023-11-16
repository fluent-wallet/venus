import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { View, Image, SafeAreaView } from 'react-native';
import { useTheme, Text } from '@rneui/themed';
import { BaseButton } from '@components/Button';
import { statusBarHeight } from '@utils/deviceInfo';
import Tip from '@assets/icons/tip.svg';
import WelcomeBg from '@assets/images/welcome-bg.png';
import clearAccountData from '@core/database/setup/clearAccountData';
import { useStructureGroupData, useAccountGroups } from '@core/WalletCore/Plugins/ReactInject';
import Plugins from '@core/WalletCore/Plugins';

export const WelcomeStackName = 'Welcome';

Plugins.BSIM.getBIMList
const Welcome: React.FC = () => {
  const { theme } = useTheme();
  const structureGroupDataoups = useStructureGroupData();
  const accountGroups = useAccountGroups();

  return (
    <LinearGradient colors={theme.colors.linearGradientBackground} className="flex-1">
      <SafeAreaView className="flex-1 flex flex-col justify-start pt-[8px]">
        {structureGroupDataoups?.map((accountGroup) => (
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
        {accountGroups.map((accountGroup) => (
          <Text key={accountGroup.id}>{accountGroup.nickname}</Text>
        ))}
        <BaseButton containerStyle={{ marginTop: 40, marginHorizontal: 16 }} onPress={() => WalletCore.methods.createHDVault()}>
          Create new Wallet
        </BaseButton>
        <BaseButton containerStyle={{ marginTop: 40, marginHorizontal: 16 }} onPress={() => clearAccountData()}>
          clear
        </BaseButton>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default Welcome;
